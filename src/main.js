/**
 * ============================================================
 *     GPV Viewer スタンドアロン版 メインスクリプト
 * ============================================================
 */

/**
 * - - - - - - - - - - - - - - - - - - - -
 * インポート
 * - - - - - - - - - - - - - - - - - - - -
 */

/** データ処理関連関数 */
import { fetchRecordFile, loadXmlFileToText, loadImageFileToBlob } from './data'

/** 共通関数 */
import {
  dateToString,
  constructMapContent,
  createDropdown,
  getCoordinatesAndTimestamps,
} from './functions'

/** スタイル */
import './style.scss'

/**
 * - - - - - - - - - - - - - - - - - - - -
 * 定数
 * - - - - - - - - - - - - - - - - - - - -
 */

/** 地図コンテナのID */
const GPX_VIEWER_CONTAINER = 'gpx_viewer'

/** 地図コンテナのスペースフィールド */
const MAP_CONTAINER = 'map_container'

/** データディレクトリ */
const DATA_DIR = './data'

/** レコードファイルのパス */
const RECORD_FILE_PATH = `${DATA_DIR}/records.json`

/**
 * - - - - - - - - - - - - - - - - - - - -
 * 関数
 * - - - - - - - - - - - - - - - - - - - -
 */

/**
 * 描画対象データを準備する
 */
const prepareData = async (record) => {
  console.log('描画対象データを準備する')
  console.log(record)

  // いったん
  return { coordinates: [], timestamps: [], photos: [] }

  // 添付ファイルフィールドから GPX ファイルを抽出する
  const files = record['GPXファイル'].value
  const gpxFile = files.find((f) => f.name.endsWith('.gpx'))
  if (!gpxFile) return

  // GPX ファイルから緯度経度高度情報配列と記録日時配列を得る
  const xmlStr = await loadXmlFileToText(gpxFile)
  const { coordinates, timestamps } = await getCoordinatesAndTimestamps(xmlStr)

  // 写真テーブルから JGP 画像を取得する
  // テーブルの個々の行には画像は1ファイルの想定
  const photos = []
  if (record['画像ファイルテーブル'].value.length) {
    record['画像ファイルテーブル'].value.forEach((row) => {
      if (
        row.value['画像ファイル'].value &&
        row.value['画像ファイル'].value.length &&
        row.value['画像ファイル'].value[0].contentType === 'image/jpeg'
      ) {
        photos.push({
          ...row.value['画像ファイル'].value[0],
          comment: row.value['画像コメント'].value || '',
        })
      }
    })

    // 画像をダウンロードして blob を確保する
    for (const photo of photos) {
      const blob = await loadImageFileToBlob(photo)
      photo.blob = blob
    }
    console.log(photos)
  }

  // 返却
  return { coordinates, timestamps, photos }
}
/**
 * 地図コンテンツ部を構築する
 */
const generateMapContent = async ({
  coordinates,
  timestamps,
  photos,
  rootContainer,
  className,
}) => {
  console.log('地図コンテンツ部を構築する')

  // コントロールボックスが既に作成済みならいったん削除する
  const curContorlBox = document.querySelector('.control-box')
  if (curContorlBox) curContorlBox.parentElement.removeChild(curContorlBox)

  // 地図コンテナ
  const mapContainer = (() => {
    // 既存のコンテナがあればそれを返却する
    const curContainer = document.getElementById(MAP_CONTAINER)
    if (curContainer) return curContainer

    // なければ作成して返却する
    const newContainer = document.createElement('div')
    newContainer.id = MAP_CONTAINER
    newContainer.classList.add(MAP_CONTAINER, className)
    rootContainer.appendChild(newContainer)
    return newContainer
  })()

  // 地図コンテンツ部を構築する
  const map = await constructMapContent({
    mapContainer,
    coordinates,
    timestamps,
    photos,
  })
  console.log(map)
}

/**
 * - - - - - - - - - - - - - - - - - - - -
 * エントリポイント
 * - - - - - - - - - - - - - - - - - - - -
 */
const main = async () => {
  console.log('gpx-viewer-standalone')
  document.querySelector('.map_container').innerHTML =
    'GPX Viewer スタンドアロン版'

  // 地図マウントルートコンテナを取得する
  const rootContainer = document.getElementById(GPX_VIEWER_CONTAINER)
  if (rootContainer) {
    // レコードファイルを取得する
    const records = await fetchRecordFile(RECORD_FILE_PATH)

    // 取得したレコードの1件目で描画する
    if (records.length) {
      // 描画対象データを準備する
      const { coordinates, timestamps, photos } = await prepareData(records[0])

      // 地図コンテンツ部を構築する
      await generateMapContent({
        coordinates,
        timestamps,
        photos,
        rootContainer,
        className: MAP_CONTAINER,
      })
    } else {
      // レコードがなければ初期値で描画する
      await generateMapContent({
        coordinates: [],
        timestamps: [],
        photos: [],
        rootContainer,
        className: MAP_CONTAINER,
      })
    }
  }
}

/** エントリポイントから開始する */
main()

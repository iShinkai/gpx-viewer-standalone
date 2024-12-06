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

  // レコードのディレクトリ
  const eachDir = record.src.replace('/record.json', '')

  // 各レコードのレコードファイルを取得する
  const eachRecord = await fetchRecordFile(`${DATA_DIR}/${record.src}`, true)
  console.log(eachRecord)

  // GPX ファイルのパス
  const gpxFile = `${DATA_DIR}/${eachDir}/${eachRecord.gpx}`
  console.log('GPX ファイルのパス')
  console.log(gpxFile)
  if (!gpxFile) return

  // GPX ファイルから緯度経度高度情報配列と記録日時配列を得る
  const xmlStr = await loadXmlFileToText(gpxFile)
  const { coordinates, timestamps } = await getCoordinatesAndTimestamps(xmlStr)

  // 写真テーブルから JGP 画像を取得する
  // テーブルの個々の行には画像は1ファイルの想定
  const photos = []
  if (eachRecord.photos.length) {
    eachRecord.photos.forEach((photo) => {
      if (
        photo.src.toLowerCase().endsWith('.jpg') ||
        photo.src.toLowerCase().endsWith('.jpeg')
      ) {
        photos.push({ src: photo.src, comment: photo.comment || '' })
      }
    })

    // 画像をダウンロードして blob を確保する
    for (const photo of photos) {
      const blob = await loadImageFileToBlob(
        `${DATA_DIR}/${eachDir}/${photo.src}`,
      )
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

  // 地図マウントルートコンテナを取得する
  const rootContainer = document.getElementById(GPX_VIEWER_CONTAINER)
  if (rootContainer) {
    // ローダーを差し込む
    showHideLoader(rootContainer, true)

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

      // レコード選択リストを設置する
      createRecordSelectDropdown(records, rootContainer)
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

    // ローダーを落とす
    showHideLoader(rootContainer, false)
  }
}

/**
 * レコード選択ドロップダウンリストを設置する
 */
const createRecordSelectDropdown = (records, container) => {
  console.log('レコード選択ドロップダウンリストを設置する')
  // ドロップダウンの項目を作成する
  const data = records.map((record) => {
    const date = record.date || ''
    return {
      label: `${record.title}${date ? ` [${dateToString(new Date(date), 'date')}]` : ''}`,
      value: record.id.toString(),
    }
  })

  // ドロップダウンを作成する
  const dropdown = createDropdown({
    data,
    container,
    className: 'record-select',
  })

  // イベントを設置する
  dropdown.addEventListener('change', async (event) => {
    console.log('ドロップダウンリストを選択')
    console.log(event.detail.value)
    const selectedRecord = records.find(
      (r) => r.id.toString() === event.detail.value,
    )
    // 地図マウントルートコンテナ要素
    const rootContainer = document.getElementById(GPX_VIEWER_CONTAINER)
    if (selectedRecord && rootContainer) {
      // ローダーを差し込む
      showHideLoader(rootContainer, true)

      // 描画対象データを準備する
      const { coordinates, timestamps, photos } =
        await prepareData(selectedRecord)

      // 地図コンテンツ部を構築する
      await generateMapContent({
        coordinates,
        timestamps,
        photos,
        rootContainer,
        className: MAP_CONTAINER,
      })

      // ローダーを落とす
      showHideLoader(rootContainer, false)
    }
  })
}

/**
 * ローダーを表示・非表示する
 */
const showHideLoader = (rootContainer, isLoading) => {
  if (isLoading) {
    const loader = document.createElement('div')
    loader.classList.add('loader')
    rootContainer.appendChild(loader)
  } else {
    const loader = rootContainer.querySelector('.loader')
    if (loader) {
      rootContainer.removeChild(loader)
    }
  }
}

/** エントリポイントから開始する */
main()

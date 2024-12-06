/**
 * ============================================================
 *     gpx-viewer 共通関数群
 * ============================================================
 */

/**
 * - - - - - - - - - - - - - - - - - - - -
 * インポート
 * - - - - - - - - - - - - - - - - - - - -
 */

/** MapLibre GL JS */
import maplibreGl, { Map, Marker, Popup } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useGsiTerrainSource } from 'maplibre-gl-gsi-terrain'

/** EXIF.js */
import EXIF from 'exif-js'

/** kintone UI Components */
import { Dropdown, ReadOnlyTable } from 'kintone-ui-component'

/**
 * - - - - - - - - - - - - - - - - - - - -
 * 定数
 * - - - - - - - - - - - - - - - - - - - -
 */

/** 表示位置コントロールボタンの配列 */
const POS_CONTROL_BUTTONS = [
  { id: 'first', label: '|◀' },
  { id: 'prev', label: '◀◀' },
  { id: 'play', label: '▶' },
  { id: 'stop', label: '||' },
  { id: 'next', label: '▶▶' },
  { id: 'last', label: '▶|' },
]

/**
 * - - - - - - - - - - - - - - - - - - - -
 * 変数
 * - - - - - - - - - - - - - - - - - - - -
 */

/** 地点リストテーブル（KUC ReadOnlyTable） */
let pointListTable = null

/** 座標配列 */
const coordinates = []

/** 記録日時配列 */
const timestamps = []

/** 写真情報配列 */
const photos = []

/** アニメーションの現在の再生位置 */
let playhead = 0

/** アニメーション再生中フラグ */
let isPlaying = false

/** マウスボタン押下中 iid */
let mouseIid = null

/** 3D表示フラグ */
let is3dView = false

/** ノースアップ表示フラグ */
let isNorthUpView = true

/** 地図パラメータ初期値 */
const defMapParams = {
  style: {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    },
    layers: [
      {
        id: 'osm-layer',
        type: 'raster',
        source: 'osm',
      },
    ],
    sky: {},
  },
  center: [139.6917, 35.6895],
  zoom: 10,
}

/** 標高タイル */
const gsiTerrainSource = useGsiTerrainSource(maplibreGl.addProtocol)
const gsiTerrainParams = {
  style: {
    version: 8,
    sources: {
      seamlessphoto: {
        type: 'raster',
        tiles: [
          'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
        ],
        maxzoom: 18,
        tileSize: 256,
        attribution:
          '<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>',
      },
      terrain: gsiTerrainSource,
    },
    layers: [
      {
        id: 'seamlessphoto',
        type: 'raster',
        source: 'seamlessphoto',
      },
    ],
    terrain: {
      source: 'terrain',
      exaggeration: 1.2,
    },
    sky: {
      'sky-color': '#2481f9',
      'sky-horizon-blend': 0.5,
      'horizon-color': '#8fcbf0',
      'horizon-fog-blend': 0.1,
      'fog-color': '#ffffff',
      'fog-ground-blend': 0.5,
    },
  },
  center: [139.6917, 35.6895],
  zoom: 13,
  pitch: 60,
  maxPitch: 85,
}

/**
 * - - - - - - - - - - - - - - - - - - - -
 * 関数
 * - - - - - - - - - - - - - - - - - - - -
 */

/**
 * 地図コンテンツ部を構築する
 */
export const constructMapContent = async ({
  mapContainer,
  coordinates,
  timestamps,
  photos,
}) => {
  // 初期値で地図を準備する
  const map = await drawMap({
    container: mapContainer.id,
    params: {
      center: coordinates.length ? coordinates[0] : defMapParams.center,
    },
  })

  // GPX ファイルに基づく地点データをポリラインで地図に描画する
  await drawCoordinatePolyline({ map, coordinates, timestamps })

  // 地図の開始位置にドットを置く
  await pointDotOnMap({
    map,
    coordinate: coordinates.length ? coordinates[0] : defMapParams.center,
  })

  // 写真をマーカーとして地図に配置する
  if (photos.length) {
    console.log(photos)
    await drawMarkersByPhotos({ map, files: structuredClone(photos) })
  }

  // コントロールボックスを作成する
  createControlBox({
    map,
    container: mapContainer.parentNode,
    mapContainer,
    coordinates,
    timestamps,
  })

  return map
}

/**
 * 指定の ID を持つ要素に指定のパラメータで地図を描画する
 */
export const drawMap = async ({ container, params }) => {
  // 表示用パラメータ
  const mapParams = (() => {
    if (is3dView) {
      return { ...gsiTerrainParams, ...params }
    }
    return { ...defMapParams, ...params }
  })()
  console.log('表示用パラメータ')
  console.log(mapParams)

  // 一旦コンテナを空にする
  const containerElem = document.getElementById(container)
  while (true) {
    if (!containerElem.children.length) break
    containerElem.removeChild(containerElem.firstChild)
  }

  // 描画する
  const map = new Map({
    container,
    ...mapParams,
  })
  await sleep(1000)

  // 返却
  return map
}

/**
 * 座標配列と日時配列を受け取り地図上にポリラインを描画する
 */
export const drawCoordinatePolyline = async ({
  map,
  coordinates,
  timestamps,
}) => {
  console.log('座標配列と日時配列を受け取り地図上にポリラインを描画する')
  // 地図にポリラインで描画する
  const line = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates,
        },
        properties: {
          timestamps,
        },
      },
    ],
  }

  map.addSource('line', {
    type: 'geojson',
    data: line,
  })

  map.addLayer({
    id: 'line-layer',
    type: 'line',
    source: 'line',
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#0000FF',
      'line-width': 7,
    },
  })
}

/**
 * XML テキストデータを GPX データにパースする
 */
export const readGpxData = (xmlStr) => {
  console.log('XMLテキストデータをGPXデータにパースする')

  // パースする
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlStr, 'application/xml')
  console.log(doc)

  // 返却
  return doc
}

/**
 * GPX ドキュメントオブジェクトから trkpt を読み取り JSON オブジェクトに変換して返却する
 */
export const getTrackPoints = (doc) => {
  console.log(
    'GPX ドキュメントオブジェクトから trkpt を読み取り JSON オブジェクトに変換して返却する',
  )

  // trkpt 要素を抽出する
  const trkpts = doc.querySelectorAll('trkpt[lat][lon]')
  console.log(trkpts)

  // JSON オブジェクトに変換する
  const trackPoints = Array.from(trkpts).map((trkpt) => {
    // 緯度経度
    const obj = {
      lat: Number(trkpt.attributes.lat.value),
      lon: Number(trkpt.attributes.lon.value),
    }

    // 標高
    const ele = trkpt.querySelector('ele')
    if (ele) {
      obj.ele = Number(ele.innerHTML)
    }

    // 記録日時
    const time = trkpt.querySelector('time')
    if (time) {
      obj.time = new Date(time.innerHTML)
    }

    return obj
  })
  console.log(trackPoints)

  // 返却
  return trackPoints
}

/**
 * GPX データから緯度経度高度情報配列と記録日時配列を得る
 */
export const getCoordinatesAndTimestamps = async (xmlStr) => {
  // XML テキストデータを GPX データにパースする
  const doc = readGpxData(xmlStr)

  // GPX データを地点データに変換する
  const trackPoints = getTrackPoints(doc)

  // 地点データと記録日時データの配列を初期化する
  coordinates.length = 0
  timestamps.length = 0

  // 地点データでループし配列に積み込むする
  trackPoints.forEach((trkpt, idx) => {
    // 経度・緯度・高度
    if (trkpt.lat && trkpt.lon) {
      const data = [trkpt.lon, trkpt.lat]
      if (trkpt.ele) {
        data.push(trkpt.ele)
      }
      coordinates.push(data)

      // 記録日時
      if (trkpt.time) {
        timestamps[idx] = trkpt.time
      }
    }
  })

  return {
    coordinates,
    timestamps,
  }
}

/**
 * 写真画像を受け取り地図上にマーカーで描画する
 * 写真画像はポップアップ内に表示する
 */
export const drawMarkersByPhotos = async ({ map, files }) => {
  console.log('写真画像を受け取り地図上にマーカーで描画する')
  photos.length = 0
  photos.push(...files)
  console.log(photos)

  // 画像データを読み取る
  const images = []
  for (const file of files) {
    images.push({
      ...(await readImageExifData(file)),
      comment: file.comment,
    })
  }

  // 地図上にマーカーを配置する
  images.forEach((image) => {
    if (image.coordinate) {
      // ポップアップの内容物
      const popupBody = document.createElement('div')

      // ボディ部
      popupBody.classList.add('popup-body')

      // -- 画像部
      const img = document.createElement('img')
      img.classList.add('popup-body-image')
      img.src = image.blobUrl
      popupBody.appendChild(img)

      // -- 説明部
      const desc = document.createElement('div')
      desc.classList.add('popup-body-desc')

      // ---- コメント
      const comment = document.createElement('div')
      comment.classList.add('popup-body-desc-comment')
      comment.innerHTML = image.comment
      desc.appendChild(comment)

      // ---- 撮影日時
      const timestamp = document.createElement('div')
      timestamp.classList.add('popup-body-desc-timestamp')
      timestamp.innerHTML = image.timestamp ? dateToString(image.timestamp) : ''
      desc.appendChild(timestamp)

      popupBody.appendChild(desc)

      // ポップアップ
      const popup = new Popup({ className: 'popup' })
        .setMaxWidth('400px')
        .setDOMContent(popupBody)

      // マーカー
      const marker = new Marker()
        .setLngLat([image.coordinate.lon, image.coordinate.lat])
        .setPopup(popup)
        .addTo(map)
      console.log(marker)
    }
  })
}

/**
 * 画像データから Exif データを読み込む
 */
const readImageExifData = async (file) => {
  // Blob URL（表示用データURL）
  const blobUrl = URL.createObjectURL(file.blob)

  // File オブジェクト
  const fileObj = new File([file.blob], file.name, { type: file.blob.type })

  // Exif データを読み取る
  const exif = await getExifData(fileObj)

  // Exif データから緯度経度高度情報を得る
  const coordinate = exifToLatLonAlt(exif)

  // Exif データから撮影日時を得る
  const timestamp = exifToTimestamp(exif)

  // 各種情報をまとめて返却する
  return {
    name: file.name,
    blobUrl,
    coordinate,
    timestamp,
  }
}

/**
 * File オブジェクトから Exif データを得る
 */
const getExifData = async (fileObj) => {
  return new Promise((resolve, reject) => {
    try {
      EXIF.getData(fileObj, function () {
        const allMetaData = EXIF.getAllTags(this)
        resolve(allMetaData)
      })
    } catch (e) {
      reject(e)
    }
  })
}

/**
 * Exif データから緯度・経度・高度の情報を取得する
 */
const exifToLatLonAlt = (exif) => {
  if (exif.GPSLatitude && exif.GPSLongitude) {
    return {
      lat:
        exif.GPSLatitude[0] +
        exif.GPSLatitude[1] / 60 +
        exif.GPSLatitude[2] / 3600,
      lon:
        exif.GPSLongitude[0] +
        exif.GPSLongitude[1] / 60 +
        exif.GPSLongitude[2] / 3600,
      alt: Number(exif.GPSAltitude),
    }
  }

  return null
}

/**
 * Exif データからタイムスタンプ（撮影日時）の情報を取得する
 */
const exifToTimestamp = (exif) => {
  // DateTimeOriginal の値（`YYYY:MM:DD HH:mm:SS`形式）
  const dateTimeOriginal =
    exif.DateTimeOriginal || exif.DateTimeDigitized || exif.DateTime || ''
  const pattern =
    /^([0-9]+)[:/]([0-9]+)[:/]([0-9]+)[T ]([0-9]+):([0-9]+):([0-9]+)/
  const matched = dateTimeOriginal.match(new RegExp(pattern))

  if (matched && matched.length) {
    const dateTimeText = `${matched[1]}/${matched[2]}/${matched[3]} ${matched[4]}:${matched[5]}:${matched[6]}`
    return new Date(dateTimeText)
  }
  return null
}

/**
 * コントロールボックスを作成する
 */
export const createControlBox = ({
  map,
  container,
  mapContainer,
  coordinates,
  timestamps,
}) => {
  // 既存のボックスを削除する
  const curBox = document.querySelector('.control-box')
  if (curBox) {
    curBox.parentElement.removeChild(curBox)
  }

  // コントローラーを格納するボックス
  const controlBox = document.createElement('div')
  controlBox.classList.add('control-box')
  container.appendChild(controlBox)

  // アニメーションコントローラーを作成する
  createAnimationControlBox({
    map,
    container: controlBox,
    mapContainer,
    buttons: POS_CONTROL_BUTTONS,
    coordinates,
    timestamps,
  })

  // ポイントのリストを作成する
  createPointListElem({
    map,
    container: controlBox,
    coordinates,
    timestamps,
  })
}

/**
 * 受け取った座標データ配列と日時データ配列でアニメーションコントローラーを作成する
 */
const createAnimationControlBox = ({
  map,
  container,
  mapContainer,
  buttons,
  coordinates,
  timestamps,
}) => {
  // ボックス全体
  const box = document.createElement('div')
  box.classList.add('animation-control-box')

  // 表示切替ボックスを作成する
  createDispControlBox(map, box, mapContainer)

  // 現在位置ボックスを作成する
  createCuurrentPosBox(box, timestamps[0])

  // 再生位置コントロールボックスを作成する
  createPosControlBox(box, buttons)

  // ボックスをコンテナに追加する
  if (container.children.length) {
    container.removeChild(container.firstChild)
  }
  container.appendChild(box)

  // 各ボタンにイベントを設置する
  if (timestamps && timestamps.length) {
    setPosControlButtonEvents({ map, coordinates, timestamps })
  }
}

/**
 * 表示切替ボックスを作成する
 */
const createDispControlBox = (map, box, mapContainer) => {
  const dispControlBox = document.createElement('div')
  dispControlBox.classList.add('disp-control-box')

  // 3Dボタン
  const threedButton = document.createElement('div')
  threedButton.classList.add('disp-control-button')
  if (is3dView) {
    threedButton.classList.add('is-active')
  }
  const threedButtonLabel = document.createElement('div')
  threedButtonLabel.classList.add('disp-control-button-label')
  threedButtonLabel.innerHTML = '3D'
  threedButton.appendChild(threedButtonLabel)
  dispControlBox.appendChild(threedButton)

  // 3Dボタンのイベント
  threedButton.addEventListener('click', async () => {
    is3dView = !is3dView
    threedButton.classList.toggle('is-active')
    await constructMapContent({ mapContainer, coordinates, timestamps, photos })
  })

  // ノースアップボタン
  const northupButton = document.createElement('div')
  northupButton.classList.add(
    'disp-control-button',
    'is-active',
    isNorthUpView ? 'is-north-up' : 'is-heading-up',
  )
  const northupButtonLabel = document.createElement('div')
  northupButtonLabel.classList.add('disp-control-button-label')
  northupButtonLabel.innerHTML = '<div>▲</div>'
  northupButton.appendChild(northupButtonLabel)
  northupButton.addEventListener('click', () => {
    northupButton.classList.toggle('is-north-up')
    northupButton.classList.toggle('is-heading-up')
    isNorthUpView = !isNorthUpView
    if (isNorthUpView) map.rotateTo(0)
  })
  dispControlBox.appendChild(northupButton)

  box.appendChild(dispControlBox)
}

/**
 * 現在位置ボックスを作成する
 */
const createCuurrentPosBox = (box, timestamp) => {
  const currentPosBox = document.createElement('div')
  currentPosBox.classList.add('current-position-box')
  currentPosBox.innerHTML = timestamp ? dateToString(timestamp) : 'no data'
  box.appendChild(currentPosBox)
}

/**
 * 再生位置コントロールボックスを作成する
 */
const createPosControlBox = (box, buttons) => {
  const posControlBox = document.createElement('div')
  posControlBox.classList.add('position-control-box')

  // コントロールボタン
  buttons.forEach((b) => {
    const button = document.createElement('div')
    button.classList.add('control-button', `button-${b.id}`, 'disabled')
    const buttonLabel = document.createElement('div')
    buttonLabel.classList.add('control-button-label')
    buttonLabel.innerHTML = b.label
    button.appendChild(buttonLabel)
    posControlBox.appendChild(button)
  })
  box.appendChild(posControlBox)
}

/**
 * 再生位置コントロールボックスの各ボタンにイベントを設置する
 */
const setPosControlButtonEvents = ({ map, coordinates, timestamps }) => {
  // -- 先頭に戻るボタン
  document.querySelector('.button-first').addEventListener('click', () => {
    movePlayheadTo({ map, coordinates, timestamps, index: 0 })
  })

  // -- 1ステップ戻るボタン
  document.querySelector('.button-prev').addEventListener('mousedown', () => {
    if (!mouseIid) {
      mouseIid = setInterval(() => {
        movePlayheadTo({ map, coordinates, timestamps, index: playhead - 1 })
      }, 20)
    }
  })
  document
    .querySelector('.button-prev')
    .addEventListener('mouseup', stopMouseInterval)
  document
    .querySelector('.button-prev')
    .addEventListener('mouseleave', stopMouseInterval)

  // -- 再生開始ボタン
  document.querySelector('.button-play').addEventListener('click', () => {
    startPlay({
      map,
      coordinates,
      timestamps,
      index: playhead,
    })
  })

  // -- 再生停止ボタン
  document.querySelector('.button-stop').addEventListener('click', () => {
    stopPlay({
      map,
      coordinates,
      timestamps,
      index: playhead,
    })
  })

  // -- 1ステップ進むボタン
  document.querySelector('.button-next').addEventListener('mousedown', () => {
    if (!mouseIid) {
      mouseIid = setInterval(() => {
        movePlayheadTo({ map, coordinates, timestamps, index: playhead + 1 })
      }, 20)
    }
  })
  document
    .querySelector('.button-next')
    .addEventListener('mouseup', stopMouseInterval)
  document
    .querySelector('.button-next')
    .addEventListener('mouseleave', stopMouseInterval)

  // -- 末尾に進むボタン
  document.querySelector('.button-last').addEventListener('click', () => {
    movePlayheadTo({
      map,
      coordinates,
      timestamps,
      index: timestamps.length - 1,
    })
  })

  // 無効クラスを外す
  document
    .querySelectorAll('.control-button')
    .forEach((button) => button.classList.remove('disabled'))
}

/**
 * 再生位置を指定ポジションに動かす
 */
const movePlayheadTo = ({ map, coordinates, timestamps, index }) => {
  // 再生位置の補正
  if (index < 0) index = 0
  if (index >= timestamps.length) index = timestamps.length - 1
  playhead = index

  // 再生位置ボックスに反映させる
  document.querySelector('.current-position-box').innerHTML = dateToString(
    timestamps[playhead],
  )

  // テーブルにクラスを反映させる
  const pointListTableBody = document.querySelector('.point-list-table tbody')
  const curRow = pointListTableBody.querySelector('tr.selected-row')
  if (curRow) curRow.classList.remove('selected-row')
  const selRow = pointListTableBody.querySelector(
    `tr:nth-of-type(${playhead + 1})`,
  )
  if (selRow) selRow.classList.add('selected-row')

  // テーブルの指定行をスクロール表示する
  selRow.scrollIntoView({
    behavior: 'auto',
    block: 'center',
  })

  // 地図に反映させる
  moveToCoordinate(map, coordinates[playhead])
}

/**
 * 繰り返し処理を停止する
 */
const stopMouseInterval = () => {
  clearInterval(mouseIid)
  mouseIid = null
}

/**
 * アニメーションの再生を開始する
 */
const startPlay = async ({ map, coordinates, timestamps, index }) => {
  isPlaying = true

  // 現在の再生位置が末尾なら最初からスタートする
  if (index >= coordinates.length - 1) index = 0

  // コントロールボックスのクラスを付け替える
  document.querySelector('.position-control-box').classList.toggle('is-playing')

  // ラインを作成する
  const line = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coordinates.slice(0, index + 1),
        },
        properties: {
          timestamps,
        },
      },
    ],
  }

  // 現在位置からアニメーションを開始する
  animateLine({ map, line, coordinates, timestamps, index })
}

/**
 * アニメーションの再生を停止する
 */
const stopPlay = () => {
  isPlaying = false

  // コントロールボックスのクラスを付け替える
  document.querySelector('.position-control-box').classList.toggle('is-playing')
}

/**
 * ポリラインをアニメーションで描画する
 */
const animateLine = ({ map, line, coordinates, timestamps, index }) => {
  // 再生停止されたら戻る
  if (!isPlaying) return

  // 新しい座標を追加する
  line.features[0].geometry.coordinates.push(coordinates[index])

  // センターをセットする
  movePlayheadTo({ map, coordinates, timestamps, index })

  // ヘディングアップの場合は地図を回転する
  if (!isNorthUpView && index + 1 < coordinates.length) {
    const degree = getDegreeBy2Coordinates(
      coordinates[index],
      coordinates[index + 1],
    )
    map.rotateTo(degree)
  }

  // GeoJSONソースを更新する
  map.getSource('line').setData(line)

  // アニメーションが続く限り再帰的に呼び出す
  if (++index < coordinates.length) {
    requestAnimationFrame(() => {
      animateLine({ map, line, coordinates, timestamps, index })
    })
  } else {
    // 末尾に到達したら再生停止する
    console.log('末尾に到達したら再生停止する')
    stopPlay()
  }
}

/**
 * 受け取った座標データ配列と日時データ配列でリストを作成する
 */
const createPointListElem = ({ map, container, coordinates, timestamps }) => {
  // ボックス全体
  const box = document.createElement('div')
  box.classList.add('point-list-box')

  // ボックスのヘッダ部
  const boxHeader = document.createElement('div')
  boxHeader.classList.add('point-list-header')

  // ステップ数
  const stepElem = document.createElement('div')
  stepElem.classList.add('point-list-steps')
  stepElem.innerHTML = `total: ${coordinates.length} steps`
  boxHeader.appendChild(stepElem)

  // 最小化ボタン
  const minButton = document.createElement('div')
  minButton.classList.add('point-list-min-button', 'is-closed')
  minButton.innerHTML = '🔼'
  minButton.title = 'リストを閉じる'
  minButton.addEventListener('click', (event) => {
    openClosePointList(event.target)
  })
  boxHeader.appendChild(minButton)

  box.appendChild(boxHeader)

  // テーブルのコンテナ
  const tableContainer = document.createElement('div')
  tableContainer.classList.add('point-list-table-container', 'is-closed')
  const tableContainerInner = document.createElement('div')
  tableContainerInner.classList.add('point-list-table-container-inner')

  // テーブルを作成する（KUC ReadOnlyTable）
  pointListTable = new ReadOnlyTable({
    columns: [
      { title: 'STEP', field: 'index' },
      { title: '緯度', field: 'lat' },
      { title: '経度', field: 'lon' },
      { title: '標高', field: 'alt' },
      { title: '日時', field: 'timestamp' },
    ],
    className: 'point-list-table',
    pagination: false,
  })
  tableContainerInner.appendChild(pointListTable)
  tableContainer.appendChild(tableContainerInner)
  box.appendChild(tableContainer)

  // コンテナに追加する
  container.appendChild(box)

  // テーブルにデータをセットする
  setPointListTable({ coordinates, timestamps })

  // テーブルにイベントを設置する
  pointListTable.addEventListener('click', (event) => {
    // クリックされた行を特定する
    const row = event.target.closest('tr')
    if (row && row.parentNode.tagName === 'TBODY') {
      Array.from(row.parentNode.children).forEach((tr) =>
        tr.classList.remove('selected-row'),
      )
      row.classList.add('selected-row')
      const rowIndex = Array.from(row.parentNode.children).indexOf(row)
      movePlayheadTo({ map, coordinates, timestamps, index: rowIndex })
    }
  })

  // 1行目を表示しておく
  setTimeout(() => {
    if (timestamps.length) {
      movePlayheadTo({ map, coordinates, timestamps, index: 0 })
    }
  }, 2000)
}

/**
 * 受け取った座標データ配列と日時データ配列でリストを更新する
 */
const setPointListTable = ({ coordinates, timestamps }) => {
  // 表示するデータを正規化する
  const data = coordinates.map((coordinate, index) => {
    return {
      index: index + 1,
      lon: (coordinate[0] ? coordinate[0] : 0).toFixed(6),
      lat: (coordinate[1] ? coordinate[1] : 0).toFixed(6),
      alt: (coordinate[2] ? coordinate[2] : 0).toFixed(1),
      timestamp: dateToString(timestamps[index], 'time'),
    }
  })

  // テーブルにデータをセットする
  pointListTable.data = data

  // ステップ数を更新する
  const stepElem = document.querySelector('.point-list-steps')
  stepElem.innerHTML = `total: ${coordinates.length} steps`

  // 日時の初期値を更新する
  document.querySelector('.current-position-box').innerHTML = timestamps.length
    ? dateToString(timestamps[0])
    : 'no data'
}

/**
 * ボタンクリックで地点リストを開閉する
 */
const openClosePointList = (target) => {
  target.classList.toggle('is-closed')
  const tableContainer = document.querySelector('.point-list-table-container')
  tableContainer.classList.toggle('is-closed')
}

/**
 * 指定の緯度経度（[経度, 緯度]）に地図のセンターを移動する
 */
const moveToCoordinate = (map, coordinate) => {
  // console.log('指定の緯度経度（[経度, 緯度]）に地図のセンターを移動する')
  // console.log(coordinate)
  map.setCenter(coordinate)
  // console.log(map)
  const point = map.getSource('points')
  if (point) {
    point.setData({
      type: 'Point',
      coordinates: coordinate,
    })
  }
}

/**
 * 地図上にドットを配置する
 * https://maplibre.org/maplibre-gl-js/docs/examples/add-image-animated/
 */
export const pointDotOnMap = async ({ map, coordinate, size = 128 }) => {
  return new Promise((resolve) => {
    console.log('地図上にドットを配置する', size, coordinate)
    const pulsingDot = {
      width: size,
      height: size,
      data: new Uint8Array(size * size * 4),

      // get rendering context for the map canvas when layer is added to the map
      onAdd() {
        const canvas = document.createElement('canvas')
        canvas.width = this.width
        canvas.height = this.height
        this.context = canvas.getContext('2d')
      },

      // called once before every frame where the icon will be used
      render() {
        const duration = 1000
        const t = (performance.now() % duration) / duration

        const radius = (size / 2) * 0.3
        const outerRadius = (size / 2) * 0.7 * t + radius
        const context = this.context

        // draw outer circle
        context.clearRect(0, 0, this.width, this.height)
        context.beginPath()
        context.arc(
          this.width / 2,
          this.height / 2,
          outerRadius,
          0,
          Math.PI * 2,
        )
        context.fillStyle = `rgba(255, 200, 200,${1 - t})`
        context.fill()

        // draw inner circle
        context.beginPath()
        context.arc(this.width / 2, this.height / 2, radius, 0, Math.PI * 2)
        context.fillStyle = 'rgba(255, 100, 100, 1)'
        context.strokeStyle = 'white'
        context.lineWidth = 2 + 4 * (1 - t)
        context.fill()
        context.stroke()

        // update this image's data with data from the canvas
        this.data = context.getImageData(0, 0, this.width, this.height).data

        // continuously repaint the map, resulting in the smooth animation of the dot
        map.triggerRepaint()

        // return `true` to let the map know that the image was updated
        return true
      },
    }

    map.addImage('pulsing-dot', pulsingDot, { pixelRatio: 2 })
    map.addSource('points', {
      type: 'geojson',
      data: {
        type: 'Point',
        coordinates: coordinate,
      },
    })
    map.addLayer({
      id: 'points',
      type: 'symbol',
      source: 'points',
      layout: {
        'icon-image': 'pulsing-dot',
        'icon-anchor': 'center',
      },
    })

    resolve()
  })
}

/**
 * ドロップダウンリストを作成して返却する
 */
export const createDropdown = ({
  data,
  container,
  className = '',
  selectedIndex = 0,
}) => {
  const dropdown = new Dropdown({
    items: data,
    className,
    selectedIndex,
  })
  container.appendChild(dropdown)

  return dropdown
}

/**
 * 日付を文字列にフォーマットする
 */
export const dateToString = (date, format = 'datetime') => {
  if (format === 'date') {
    return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`
  } else if (format === 'time') {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
  }
  return `${dateToString(date, 'date')} ${dateToString(date, 'time')}`
}

/**
 * 2点の座標から角度を得る
 */
export const getDegreeBy2Coordinates = (coordinate1, coordinate2) => {
  // それぞれの緯度経度をラジアンに変換する
  const lat1 = toRadians(coordinate1[1])
  const lon1 = toRadians(coordinate1[0])
  const lat2 = toRadians(coordinate2[1])
  const lon2 = toRadians(coordinate2[0])

  // 経度差
  const dLon = lon2 - lon1

  // 球面三角法に基づき計算する
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  const degree = (toDegrees(Math.atan2(y, x)) + 360) % 360

  return degree
}

/**
 * 角度をラジアンに変換する
 */
const toRadians = (degrees) => (degrees * Math.PI) / 180

/**
 * ラジアンを角度に変換する
 */
const toDegrees = (radians) => (radians * 180) / Math.PI

/**
 * 指定ミリ秒スリープする
 */
const sleep = (msec) => new Promise((resolve) => setTimeout(resolve, msec))

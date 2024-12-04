/**
 * ============================================================
 *     gpx-viewer データ取得関連関数群
 * ============================================================
 */

/**
 * - - - - - - - - - - - - - - - - - - - -
 * インポート
 * - - - - - - - - - - - - - - - - - - - -
 */

/**
 * - - - - - - - - - - - - - - - - - - - -
 * 関数
 * - - - - - - - - - - - - - - - - - - - -
 */

/**
 * 指定のレコードファイルを取得して JSON データを返却する
 */
export const fetchRecordFile = async (file) => {
  console.log('指定のレコードファイルを取得して JSON データを返却する')

  // JSON ファイルでなければ何もしない
  if (!file.toLowerCase().endsWith('.json')) return []

  // Fetch API でデータを取得する
  const response = await downloadFile(file)
  if (!response.ok) {
    console.warn(response)
    return []
  }

  // JSON として取得する
  try {
    const json = await response.json()
    console.log(json)
    if (!json.records) return []

    // 返却
    return json.records
  } catch (e) {
    console.error('レコードファイルの取得に失敗しました')
    console.error(e)
    return []
  }
}

/**
 * ファイルをダウンロードしバッファを返却する
 */
export const downloadFile = async (file) => {
  // Fetch API でファイルを取得する
  const arrayBuffer = await fetch(file)

  // 返却
  return arrayBuffer
}

/**
 * XMLファイルを取得し文字列で返却する
 */
export const loadXmlFileToText = async (file) => {
  const arrayBuffer = await downloadFile(file)
  const textDecoder = new TextDecoder()
  const xmlStr = textDecoder.decode(arrayBuffer)

  // 返却
  return xmlStr
}

/**
 * 画像ファイルを取得し Blob で返却する
 */
export const loadImageFileToBlob = async (file) => {
  const arrayBuffer = await downloadFile(file)
  const blob = new Blob([arrayBuffer])

  // 返却
  return blob
}

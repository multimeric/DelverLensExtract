import React, { useEffect, useState } from 'react';
import './App.css';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { ZipArchive } from "@shortercode/webzip";
import { CSVLink, CSVDownload } from "react-csv";


async function process(apk: FileList, dlens: FileList): Promise<any[]> {
  const sqlite3 = await sqlite3InitModule({
    print: (...args: any) => console.log(...args),
    printErr: (...args: any) => console.error(...args),
  });
  const db = new sqlite3.oo1.DB();
  const cardMap = await getApkCardTable(apk, sqlite3, db);
  const scannedCards = await getScannedCards(dlens, sqlite3, db);
  const result = scannedCards.map((card: any) => {
    return { ...card, name: cardMap[card.card] }
  });
  console.log(result);
  return result;
}

async function getScannedCards(dlens: FileList, sqlite3: any, db: any) {
  const buffer = await dlens[0].arrayBuffer();
  const rc = sqlite3.capi.sqlite3_deserialize(
    db.pointer,
    'main',
    sqlite3.wasm.allocFromTypedArray(new Uint8Array(buffer)),
    buffer.byteLength,
    buffer.byteLength,
    sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE
  );

  return db.exec([
    "SELECT * FROM cards"
  ], {
    returnValue: "resultRows",
    rowMode: "object"
  });
}

// Returns a mapping of card IDs to card names
async function getApkCardTable(apk: FileList, sqlite3: any, db: any) {

  const apkBuffer = await (await ZipArchive.from_blob(apk[0]))
    .get("res/raw/data.db")
    ?.get_array_buffer();

  if (!apkBuffer) {
    throw new Error("Couldn't read APK");
  }

  const rc = sqlite3.capi.sqlite3_deserialize(
    db.pointer,
    'main',
    sqlite3.wasm.allocFromTypedArray(new Uint8Array(apkBuffer)),
    apkBuffer.byteLength,
    apkBuffer.byteLength,
    sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE
  );

  const rows = db.exec([
    "SELECT cards._id, names.name FROM cards JOIN names ON cards.name = names._id;"
  ], {
    returnValue: "resultRows"
  });

  return Object.fromEntries(rows);
}

function App() {
  const [apk, setApk] = useState<FileList>();
  const [dlens, setDlens] = useState<FileList>();
  const [csvData, setCsvData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Whenever a file changes, invalidate the CSV
  useEffect(() => {
    setCsvData(null);
  }, [apk, dlens])

  useEffect(() => {
    if (apk && dlens && (!csvData)) {
      setLoading(true);
      const csv = process(apk, dlens).then(data => {
        setCsvData(data);
        setLoading(false);
      });
    }
  }, [apk, dlens, csvData])

  return (
    <form style={{
      display: 'flex',
      flexDirection: 'column',
      maxWidth: "500px",
      marginLeft: "auto",
      marginRight: "auto"
    }}>
      <label>APK</label>
      <input
        type="file"
        accept=".apk"
        onChange={e => {
          if (e.target.files) {
            setApk(e.target.files)
          }
        }
        } />
      <label>dlens File</label>
      <input
        type="file"
        accept=".dlens"
        onChange={e => {
          if (e.target.files) {
            setDlens(e.target.files)
          }
        }
        }
      />
      {loading && "Loading, please wait!"}
      {csvData && <CSVLink data={csvData} filename="cards.csv">Download me</CSVLink>}
    </form>
  );
}

export default App;

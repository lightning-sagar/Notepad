const mongoose = require("mongoose");
const initData = require("./data");
const note = require("../models/note");

main().then(()=>{
    console.log("connectrd to DB");
  })
  .catch(err => console.log(err))
  
  async function main() {
    await mongoose.connect('mongodb://127.0.0.1:27017/Note')
}

const initDB = async () => {
    await note.insertMany(initData.data)
    console.log("data is inserted");
}

initDB()
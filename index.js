const express = require("express");
const user = require("./model/user");
const Post = require("./model/post");
const app = express();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const { mongoose } = require("mongoose");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const uploadMiddleware = multer({ dest: "uploads/" });
const fs = require("fs");
const DATABASE_URL = process.env.DATABASE_URL;
const PORT = process.env.PORT || 4000;


// <=== access granting ===>
app.use(cors({ credentials: true, origin: "http://localhost:3000" }));
app.use(express.json()); // parse
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));

const salt = bcrypt.genSaltSync(10);
const secret = "gwbduqjwsnjdnjamkjdsmxsdgth";

// connection of db
mongoose.connect(
  "mongodb+srv://enbik:gWBRrXI1IZgDuOLl@cluster0.xctxwz8.mongodb.net/?retryWrites=true&w=majority" || DATABASE_URL
);

// =============================== Register =============================>

app.post("/register", async (request, response) => {
  const { username, password } = request.body;
  try {
    const userDoc = await user.create({
      username,
      password: bcrypt.hashSync(password, salt),
    });
    response.json(userDoc);
  } catch (e) {
    response.status(400).json(e);
  }
});

// <========================================= Login =====================================>

app.post("/login", async (request, response) => {
  console.log(DATABASE_URL)
  const { username, password } = request.body;
  const userDoc = await user.findOne({ username });
  const passOk = bcrypt.compareSync(password, userDoc.password);
  if (passOk) {
    //logged in
    jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
      if (err) throw err;
      // res.json(token)
      response.cookie("token", token).json({
        id: userDoc._id,
        username,
      });
    });
  } else {
    response.status(400).json("Wrong Credentials");
  }
});

app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  console.log(token)
  jwt.verify(token, secret, {}, (err, info) => {
    if (err) throw err;
    res.json(info);
  });
  res.json(req.cookies);
});

app.post("/logout", (req, res) => {
  res.cookie("token", "").json("ok");
});

// create new post --->

app.post("/post", uploadMiddleware.single("file"), async (req, res) => {
  const { originalname, path } = req.file;
  const part = originalname.split(".");
  const ext = part[part.length - 1];
  const newPath = path + "." + ext;
  fs.renameSync(path, newPath);

  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;
    const { title, summary, content } = req.body;

    const postDoc = await Post.create({
      title,
      summary,
      content,
      image: newPath,
      author: info.id,
    });
    res.json(postDoc);
  });
});


app.put('/post',uploadMiddleware.single("file"), (req,res) =>{
    const newPath = null;
    if(res.file){
        const { originalname, path } = req.file;
        const part = originalname.split(".");
        const ext = part[part.length - 1];
        newPath = path + "." + ext;
        fs.renameSync(path, newPath);
    }

    const {token} = req.cookies;
    jwt.verify(token, secret, {}, async (err, info) => {
        if (err) throw err;
        const { id, title, summary, content } = req.body;
        const postDoc = await Post.findById(id);
        const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
        if(!isAuthor){
            return res.status(400).json("You are not the Author");
        }
        await postDoc.updateOne({
            title,
            summary,
            content,
            image:newPath ? newPath : postDoc.image,
        });

        res.json(postDoc);
    });
});


app.get("/post", async (req, res) => {
  res.json(
    await Post.find()
      .populate("author", ["username"])
      .sort({ createdAt: -1 })
      .limit(20)
  );
});

app.get("/post/:id", async (req, res) => {
  const { id } = req.params;
  const postDoc = await Post.findById(id).populate('author',['username']);
  res.json(postDoc);
});

app.listen(PORT);

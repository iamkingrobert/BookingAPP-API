const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("./models/user.js");
const Place = require("./models/place.js");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const fs = require("fs");
const imageDownloader = require("image-downloader");
require("dotenv").config();
const app = express();

const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = "eyJhb7GciOiJIU6asdnsslan9sbsm";

app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT"],
    credentials: true,
  })
);

mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
});
console.log(`MongoDB Connected Successfully`);

app.get("/afroTravel", (req, res) => {
  res.json("Test Successful");
});

//Create New User
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const UserDoc = await User.create({
      name,
      email,
      password: bcrypt.hashSync(password, bcryptSalt),
    });
    res.json(UserDoc);
  } catch (error) {
    res.status(422).json(error);
  }
});

//Login Existing User
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const UserDoc = await User.findOne({ email });

  if (UserDoc) {
    const passOK = bcrypt.compareSync(password, UserDoc.password);
    if (passOK) {
      jwt.sign(
        { email: UserDoc.email, id: UserDoc._id },
        jwtSecret,
        {},
        (err, token) => {
          if (err) throw err;
          res.cookie("token", token).json(UserDoc);
        }
      );
    } else {
      res.status(422).json("Password Invalid");
    }
  } else {
    res.json("User Not Found");
  }
});

app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  if (token) {
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
      if (err) throw err;
      const { name, email, _id } = await User.findById(userData.id);
      res.json({ name, email, _id });
    });
  } else {
    res.json(null);
  }
});

app.post("/logout", (req, res) => {
  res.cookie("token", "").json(true);
});

app.post("/upload-by-link", async (req, res) => {
  const { link } = req.body;
  const newName = "photo" + Date.now() + ".jpg";
  await imageDownloader.image({
    url: link,
    dest: __dirname + "/uploads/" + newName,
  });
  res.json(newName);
});

const photosMiddleware = multer({ dest: "uploads" });
app.post("/upload", photosMiddleware.array("photos", 100), (req, res) => {
  const uploadedFiles = [];
  for (let i = 0; i < req.files.length; i++) {
    const { path, originalname } = req.files[i];
    const parts = originalname.split(".");
    const ext = parts[parts.length - 1];
    const newPath = path + "." + ext;
    fs.renameSync(path, newPath);
    uploadedFiles.push(newPath.replace("uploads/", ""));
  }
  res.json(uploadedFiles);
});

app.post("/places", (req, res) => {
  const { token } = req.cookies;
  const {
    title,
    address,
    description,
    features,
    extraInfo,
    addedPhoto,
    checkIn,
    checkOut,
    maxGuests,
    price,
  } = req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const placeDoc = await Place.create({
      owner: userData.id,
      title,
      address,
      description,
      features,
      extraInfo,
      photos: addedPhoto,
      checkIn,
      checkOut,
      maxGuests,
      price,
    });
    res.json(placeDoc);
  });
});

app.get("/places", (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    const { id } = userData;
    res.json(await Place.find({ owner: id }));
  });
});

app.get("/places/:id", async (req, res) => {
  const { id } = req.params;
  res.json(await Place.findById(id));
});

app.put("/places", async (req, res) => {
  const { token } = req.cookies;
  const {
    id,
    title,
    address,
    addedPhoto,
    description,
    features,
    extraInfo,
    checkIn,
    checkOut,
    maxGuests,
    price,
  } = req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const placeDoc = await Place.findById(id);
    if (userData.id === placeDoc.owner.toString()) {
      placeDoc.set({
        title,
        address,
        photos: addedPhoto,
        description,
        features,
        extraInfo,
        checkIn,
        checkOut,
        maxGuests,
        price,
      });
      await placeDoc.save();
      res.json("Place Updated Successfully");
    }
  });
});

app.listen(4000, function () {
  console.log("App is running on Port 4000");
});

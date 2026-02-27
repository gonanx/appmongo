const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "..", "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  favoritos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Business' }]
});

const User = mongoose.model("User", userSchema);

const businessSchema = new mongoose.Schema({
  nombre: String,
  categoria: String,
  subcategoria: String,
  contacto: String,
  ubicacion: String,
  fotos: [String],
  puntuacion: Number
});

const Business = mongoose.model("Business", businessSchema, "negocios");

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ Conectado a MongoDB"))
  .catch((err) => console.error("❌ Error MongoDB:", err));

app.get("/", (req, res) => res.render("landing"));
app.get("/register", (req, res) => res.render("register"));
app.get("/login", (req, res) => res.render("login"));
app.get("/logout", (req, res) => res.redirect("/"));

app.get("/dashboard", async (req, res) => {
  try {
    const { q, ciudad } = req.query;
    let query = {};
    if (q || ciudad) {
      const filters = [];
      if (q) {
        filters.push({
          $or: [
            { nombre: { $regex: q, $options: "i" } },
            { categoria: { $regex: q, $options: "i" } },
            { subcategoria: { $regex: q, $options: "i" } }
          ]
        });
      }
      if (ciudad) {
        filters.push({ ubicacion: { $regex: ciudad, $options: "i" } });
      }
      query = filters.length > 0 ? { $and: filters } : {};
    }
    const negocios = await Business.find(query);
    res.render("dashboard", {
      user: { name: "Invitado", favoritos: [], _id: null },
      negocios,
      searchQuery: q || "",
      ciudadQuery: ciudad || ""
    });
  } catch (err) {
    res.status(500).send("Error");
  }
});

app.post("/favoritos", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.redirect("/login");
    const user = await User.findById(userId).populate('favoritos');
    res.render("favoritos", { user, negocios: user.favoritos });
  } catch (err) {
    res.redirect("/dashboard");
  }
});

app.post("/favoritos/add", async (req, res) => {
  try {
    const { userId, businessId } = req.body;
    await User.findByIdAndUpdate(userId, { $addToSet: { favoritos: businessId } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post("/favoritos/remove", async (req, res) => {
  try {
    const { userId, businessId } = req.body;
    await User.findByIdAndUpdate(userId, { $pull: { favoritos: businessId } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.send("El usuario ya existe.");
    const newUser = new User({ name, email, password, favoritos: [] });
    await newUser.save();
    res.redirect("/login");
  } catch (err) {
    res.status(500).send("Error");
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).populate('favoritos');
    if (!user || user.password !== password) return res.send("Error");
    const negocios = await Business.find();
    res.render("dashboard", { user, negocios, searchQuery: "", ciudadQuery: "" });
  } catch (err) {
    res.status(500).send("Error");
  }
});

app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
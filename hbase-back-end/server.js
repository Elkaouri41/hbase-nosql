const express = require("express");
const axios = require("axios");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const port = 7070;

// Configuration HBase REST API
const HBASE_REST_URL = "http://127.0.0.1:8080";
const TABLE_NAME = "users";
const COLUMN_FAMILY = "info";

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Initialisation de la table (Exécuter une seule fois)
app.get("/init", async (req, res) => {
  try {
    await axios.post(`${HBASE_REST_URL}/${TABLE_NAME}/schema`, {
      name: TABLE_NAME,
      ColumnSchema: [{ name: COLUMN_FAMILY }],
    });
    res.status(200).send("Table users créée avec succès.");
  } catch (err) {
    res.status(500).send(`Erreur: ${err.message}`);
  }
});

// Ajouter un utilisateur (C)
app.post("/users", async (req, res) => {
  try {
    const { id, name, email, age } = req.body;
    const data = {
      Row: [
        {
          key: Buffer.from(id).toString("base64"),
          Cell: [
            {
              column: Buffer.from(`${COLUMN_FAMILY}:name`).toString("base64"),
              $: Buffer.from(name).toString("base64"),
            },
            {
              column: Buffer.from(`${COLUMN_FAMILY}:email`).toString("base64"),
              $: Buffer.from(email).toString("base64"),
            },
            {
              column: Buffer.from(`${COLUMN_FAMILY}:age`).toString("base64"),
              $: Buffer.from(age.toString()).toString("base64"),
            },
          ],
        },
      ],
    };
    await axios.put(`${HBASE_REST_URL}/${TABLE_NAME}/${id}`, data);
    res.status(201).send(`Utilisateur ${id} ajouté.`);
  } catch (err) {
    res.status(500).send(`Erreur: ${err.message}`);
  }
});

// Récupérer tous les utilisateurs avec pagination (R)
app.get("/users", async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    // 1. Créer un scanner
    const scannerResponse = await axios.put(
      `${HBASE_REST_URL}/${TABLE_NAME}/scanner`,
      { batch: 100 },
      { headers: { Accept: "application/json" } }
    );

    const scannerId = scannerResponse.headers.location.split("/").pop();

    // 2. Lire les données du scanner
    const response = await axios.get(`${HBASE_REST_URL}/${TABLE_NAME}/scanner/${scannerId}`, {
      headers: { Accept: "application/json" },
    });

    let users = response.data.Row.map((row) => {
      const user = { id: Buffer.from(row.key, "base64").toString() };
      row.Cell.forEach((cell) => {
        const column = Buffer.from(cell.column, "base64").toString().split(":")[1];
        user[column] = Buffer.from(cell.$, "base64").toString();
      });
      return user;
    });

    // 3. Tri par ID et pagination
    users = users.sort((a, b) => a.id.localeCompare(b.id)); // Tri par ID
    const paginatedUsers = users.slice((page - 1) * limit, page * limit);

    res.json({ users: paginatedUsers, total: users.length });
  } catch (err) {
    res.status(500).send(`Erreur: ${err.message}`);
  }
});



// Récupérer un utilisateur par ID (R)
app.get("/users/:id", async (req, res) => {
  try {
    const response = await axios.get(`${HBASE_REST_URL}/${TABLE_NAME}/${req.params.id}`);
    const cells = response.data.Row[0].Cell.reduce((acc, cell) => {
      const column = Buffer.from(cell.column, "base64").toString().split(":")[1];
      acc[column] = Buffer.from(cell.$, "base64").toString();
      return acc;
    }, {});
    res.json({ id: req.params.id, ...cells });
  } catch (err) {
    res.status(500).send(`Erreur: ${err.message}`);
  }
});

// Mettre à jour un utilisateur (U)
app.put("/users/:id", async (req, res) => {
  try {
    const { name, email, age } = req.body;
    const data = {
      Row: [
        {
          key: Buffer.from(req.params.id).toString("base64"),
          Cell: [
            {
              column: Buffer.from(`${COLUMN_FAMILY}:name`).toString("base64"),
              $: Buffer.from(name).toString("base64"),
            },
            {
              column: Buffer.from(`${COLUMN_FAMILY}:email`).toString("base64"),
              $: Buffer.from(email).toString("base64"),
            },
            {
              column: Buffer.from(`${COLUMN_FAMILY}:age`).toString("base64"),
              $: Buffer.from(age.toString()).toString("base64"),
            },
          ],
        },
      ],
    };
    await axios.put(`${HBASE_REST_URL}/${TABLE_NAME}/${req.params.id}`, data);
    res.send(`Utilisateur ${req.params.id} mis à jour.`);
  } catch (err) {
    res.status(500).send(`Erreur: ${err.message}`);
  }
});

// Supprimer un utilisateur (D)
app.delete("/users/:id", async (req, res) => {
  try {
    await axios.delete(`${HBASE_REST_URL}/${TABLE_NAME}/${req.params.id}`);
    res.send(`Utilisateur ${req.params.id} supprimé.`);
  } catch (err) {
    res.status(500).send(`Erreur: ${err.message}`);
  }
});

// Démarrer le serveur
app.listen(port, () => {
  console.log(`Serveur en cours d'exécution sur http://localhost:${port}`);
});

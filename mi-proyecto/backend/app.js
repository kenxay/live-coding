// backend/app.js
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
// En un proyecto real esto va en un archivo .env, pero para el hackathon está bien aquí
const SECRET_KEY = "llave_maestra_hackathon"; 

// --- MIDDLEWARES BÁSICOS ---
app.use(cors());
app.use(express.json());

// --- CONEXIÓN A LA BASE DE DATOS ---
const dbPath = path.resolve(__dirname, 'data/notas.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, password TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS notas (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, titulo TEXT, contenido TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES usuarios(id)
    )`);
});

// --- MIDDLEWARE DE AUTENTICACIÓN (El Guardián) ---
// Esta función protege las rutas. Verifica si el usuario trae su "pulsera VIP" (Token JWT).
const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ error: "Acceso denegado. Token requerido." });

    const token = authHeader.split(" ")[1]; // El formato es "Bearer <token>"
    
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ error: "Token inválido o expirado." });
        req.userId = decoded.id; // Guardamos el ID del usuario en la petición para usarlo luego
        next(); // Todo correcto, le dejamos pasar a la ruta
    });
};

// ==========================================
//                 RUTAS PÚBLICAS
// ==========================================

// 1. REGISTRO DE USUARIO
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;

    // Validación (Survival Checklist)
    if (!email || !password) {
        return res.status(400).json({ error: "Email y contraseña son obligatorios." });
    }

    try {
        // Encriptamos la contraseña con un "coste" de 10
        const hashPassword = await bcrypt.hash(password, 10);
        
        // Usamos '?' para evitar Inyección SQL
        const query = `INSERT INTO usuarios (email, password) VALUES (?, ?)`;
        db.run(query, [email, hashPassword], function(err) {
            if (err) {
                // Si el email ya existe en la BD (por el UNIQUE constraint)
                return res.status(400).json({ error: "El correo ya está registrado." });
            }
            res.status(201).json({ message: "Usuario creado con éxito. Ya puedes iniciar sesión." });
        });
    } catch (error) {
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

// 2. INICIO DE SESIÓN
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ error: "Faltan credenciales." });

    db.get(`SELECT * FROM usuarios WHERE email = ?`, [email], async (err, user) => {
        if (err) return res.status(500).json({ error: "Error en la base de datos." });
        if (!user) return res.status(401).json({ error: "Credenciales incorrectas." }); // No damos pistas de si el email existe

        // Comparamos la contraseña en texto plano con el hash de la BD
        const passwordValida = await bcrypt.compare(password, user.password);
        if (!passwordValida) return res.status(401).json({ error: "Credenciales incorrectas." });

        // Si todo está bien, generamos el Token JWT (pulsera VIP) válido por 2 horas
        const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '2h' });
        
        // Retornamos el token, pero NUNCA devolvemos el hash de la contraseña en el JSON
        res.json({ message: "Login exitoso", token: token }); 
    });
});

// ==========================================
//        RUTAS PROTEGIDAS (Requieren Token)
// ==========================================

// 3. OBTENER NOTAS DEL USUARIO
// Usamos el middleware 'verificarToken' antes de ejecutar el código
app.get('/api/notas', verificarToken, (req, res) => {
    // Solo buscamos las notas donde el user_id coincida con el ID del token (Autorización correcta)
    const query = `SELECT * FROM notas WHERE user_id = ? ORDER BY id DESC`;
    
    db.all(query, [req.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: "Error al recuperar las notas." });
        res.json(rows);
    });
});

// 4. CREAR UNA NOTA NUEVA
app.post('/api/notas', verificarToken, (req, res) => {
    const { titulo, contenido } = req.body;

    // Validación de datos vacíos
    if (!titulo || !contenido) return res.status(400).json({ error: "El título y contenido no pueden estar vacíos." });

    const query = `INSERT INTO notas (user_id, titulo, contenido) VALUES (?, ?, ?)`;
    
    db.run(query, [req.userId, titulo, contenido], function(err) {
        if (err) return res.status(500).json({ error: "Error al guardar la nota." });
        res.status(201).json({ id: this.lastID, titulo, contenido });
    });
});

// --- INICIAR SERVIDOR ---
app.listen(PORT, () => {
    console.log(`🚀 Servidor backend levantado en http://localhost:${PORT}`);
});

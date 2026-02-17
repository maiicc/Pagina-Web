const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(express.json());
app.use(cors());

app.use(express.static(__dirname));

const DB_URL = process.env.DATABASE_URL || "mysql://avnadmin:AVNS_eJq96bEJvh_J44PjY8n@mysql-17363d9c-carreromiguel37-1ff4.i.aivencloud.com:25214/defaultdb?ssl-mode=REQUIRED";

const db = mysql.createPool({
    uri: DB_URL,
    ssl: {
        rejectUnauthorized: false 
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

app.post('/registro', async (req, res) => {
    const { nombre, apellido, cedula, email, password, rol, cedula_hijo } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        const sql = "INSERT INTO usuarios (nombre, apellido, cedula, email, password_hash, rol, cedula_representado) VALUES (?, ?, ?, ?, ?, ?, ?)";
        db.query(sql, [nombre, apellido, cedula, email, hash, rol, cedula_hijo], (err, result) => {
            if (err) return res.status(500).send("Error: Correo o Cédula duplicados.");
            res.send({ mensaje: "Usuario guardado con éxito" });
        });
    } catch (error) { res.status(500).send("Error interno"); }
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const sql = "SELECT id_usuario, nombre, rol, password_hash, cedula_representado FROM usuarios WHERE email = ?";
    db.query(sql, [email], async (err, result) => {
        if (err || result.length === 0) return res.status(401).send("Usuario no existe");
        const user = result[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (match) {
            res.send({ 
                id_usuario: user.id_usuario,
                nombre: user.nombre, 
                rol: user.rol,
                cedula_hijo: user.cedula_representado
            });
        } else { res.status(401).send("Clave incorrecta"); }
    });
});

app.get('/nombre-hijo/:cedula', (req, res) => {
    db.query("SELECT nombre FROM usuarios WHERE cedula = ?", [req.params.cedula], (err, result) => {
        if (err || result.length === 0) return res.status(404).send("No encontrado");
        res.send(result[0]);
    });
});

app.get('/mis-notas/:nombre', (req, res) => {
    db.query("SELECT asignatura, nota, fecha_registro FROM calificaciones WHERE estudiante = ? ORDER BY fecha_registro DESC", [req.params.nombre], (err, results) => {
        if (err) return res.status(500).send(err);
        res.send(results);
    });
});

app.post('/guardar-nota', (req, res) => {
    const { estudiante, asignatura, nota, rol } = req.body;
    const sql = "INSERT INTO calificaciones (estudiante, asignatura, nota, rol_quien_registro) VALUES (?, ?, ?, ?)";
    db.query(sql, [estudiante, asignatura, nota, rol], (err, result) => {
        if (err) return res.status(500).send(err);
        res.send({ mensaje: "Nota guardada" });
    });
});

app.get('/usuarios', (req, res) => {
    db.query("SELECT id_usuario, nombre, apellido, rol FROM usuarios", (err, results) => {
        if (err) return res.status(500).send(err);
        res.send(results);
    });
});

app.post('/enviar-mensaje', (req, res) => {
    const { remitente_id, destinatario_id, asunto, contenido } = req.body;
    const sql = "INSERT INTO mensajes (remitente_id, destinatario_id, asunto, contenido) VALUES (?, ?, ?, ?)";
    db.query(sql, [remitente_id, destinatario_id, asunto, contenido], (err) => {
        if (err) return res.status(500).send(err);
        res.send({ mensaje: "Enviado" });
    });
});

app.get('/mensajes/:userId', (req, res) => {
    const sql = `SELECT m.*, u.nombre AS nombre_remitente FROM mensajes m 
                 JOIN usuarios u ON m.remitente_id = u.id_usuario 
                 WHERE m.destinatario_id = ? ORDER BY m.fecha_envio DESC`;
    db.query(sql, [req.params.userId], (err, results) => {
        if (err) return res.status(500).send(err);
        res.send(results);
    });
});

app.get('/perfil/:id', (req, res) => {
    db.query("SELECT nombre, apellido, cedula, email, rol, cedula_representado FROM usuarios WHERE id_usuario = ?", [req.params.id], (err, result) => {
        if (err || result.length === 0) return res.status(404).send("No encontrado");
        res.json(result[0]);
    });
});

app.get('/stats-docente', (req, res) => {
    const q = "SELECT (SELECT COUNT(*) FROM usuarios WHERE rol='Estudiante') as estudiantes, (SELECT COUNT(*) FROM calificaciones WHERE nota < 10) as alertas, (SELECT COUNT(*) FROM calificaciones) as evaluaciones";
    db.query(q, (err, result) => {
        if (err) return res.status(500).send(err);
        res.json(result[0]);
    });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));


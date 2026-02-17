const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// ============================================================
// CONFIGURACIÓN DE LA BASE DE DATOS (Clever Cloud)
// ============================================================
// PASO IMPORTANTE: Pega aquí abajo tu "Connection URI" que te dio Clever Cloud. 
// Tiene que verse algo como: mysql://usuario:password@host:puerto/nombre_db
const DB_URL = "mysql://u2d6b5duaebwvhb4:DFPP4gU5Xv7tX3BaIJCf@buppvqijao8xm38bxuym-mysql.services.clever-cloud.com:3306/buppvqijao8xm38bxuym";

const db = mysql.createConnection(DB_URL);

db.connect((err) => {
    if (err) {
        console.error('❌ Error conectando a la base de datos:', err.message);
        return;
    }
    console.log('✅ Conexión exitosa a la base de datos en la nube (Clever Cloud)');
});
// ============================================================

// REGISTRO DE USUARIOS
app.post('/registro', async (req, res) => {
    const { nombre, apellido, cedula, email, password, rol, cedula_hijo } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        const sql = "INSERT INTO usuarios (nombre, apellido, cedula, email, password_hash, rol, cedula_representado) VALUES (?, ?, ?, ?, ?, ?, ?)";
        db.query(sql, [nombre, apellido, cedula, email, hash, rol, cedula_hijo], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).send("El correo o cédula ya existen.");
            }
            res.send({ mensaje: "Usuario guardado en la base de datos" });
        });
    } catch (error) {
        res.status(500).send("Error interno del servidor");
    }
});

// LOGIN DE USUARIOS
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
        } else {
            res.status(401).send("Clave incorrecta");
        }
    });
});

// BUSCAR HIJO
app.get('/nombre-hijo/:cedula', (req, res) => {
    const sql = "SELECT nombre FROM usuarios WHERE cedula = ?";
    db.query(sql, [req.params.cedula], (err, result) => {
        if (err || result.length === 0) return res.status(404).send("Hijo no encontrado");
        res.send(result[0]);
    });
});

// MIS NOTAS
app.get('/mis-notas/:nombre', (req, res) => {
    const sql = "SELECT asignatura, nota, fecha_registro FROM calificaciones WHERE estudiante = ? ORDER BY fecha_registro DESC";
    db.query(sql, [req.params.nombre], (err, results) => {
        if (err) return res.status(500).send(err);
        res.send(results);
    });
});

// GUARDAR NOTA
app.post('/guardar-nota', (req, res) => {
    const { estudiante, asignatura, nota, rol } = req.body;
    if (nota < 0 || nota > 20) return res.status(400).send("La nota debe estar entre 0 y 20");
    const sql = "INSERT INTO calificaciones (estudiante, asignatura, nota, rol_quien_registro) VALUES (?, ?, ?, ?)";
    db.query(sql, [estudiante, asignatura, nota, rol], (err, result) => {
        if (err) return res.status(500).send("Error al guardar");
        res.send({ mensaje: "Nota guardada correctamente", id: result.insertId });
    });
});

// OBTENER TODAS LAS NOTAS
app.get('/obtener-notas', (req, res) => {
    db.query("SELECT * FROM calificaciones ORDER BY fecha_registro DESC", (err, results) => {
        if (err) return res.status(500).send(err);
        res.send(results);
    });
});

// LISTA DE USUARIOS
app.get('/usuarios', (req, res) => {
    db.query("SELECT id_usuario, nombre, apellido, rol FROM usuarios", (err, results) => {
        if (err) return res.status(500).send(err);
        res.send(results);
    });
});

// ENVIAR MENSAJE
app.post('/enviar-mensaje', (req, res) => {
    const { remitente_id, destinatario_id, asunto, contenido } = req.body;
    const sql = "INSERT INTO mensajes (remitente_id, destinatario_id, asunto, contenido) VALUES (?, ?, ?, ?)";
    db.query(sql, [remitente_id, destinatario_id, asunto, contenido], (err, result) => {
        if (err) return res.status(500).send(err);
        res.send({ mensaje: "Enviado con éxito" });
    });
});

// OBTENER MENSAJES
app.get('/mensajes/:userId', (req, res) => {
    const userId = req.params.userId;
    const sql = `
        SELECT m.*, u.nombre AS nombre_remitente, u.apellido AS apellido_remitente 
        FROM mensajes m 
        JOIN usuarios u ON m.remitente_id = u.id_usuario 
        WHERE m.destinatario_id = ? 
        ORDER BY m.fecha_envio DESC`;
    db.query(sql, [userId], (err, results) => {
        if (err) return res.status(500).send(err);
        res.send(results);
    });
});

// PERFIL
app.get('/perfil/:id', (req, res) => {
    const sql = "SELECT nombre, apellido, cedula, email, rol, cedula_representado FROM usuarios WHERE id_usuario = ?";
    db.query(sql, [req.params.id], (err, result) => {
        if (err || result.length === 0) return res.status(404).send("No encontrado");
        res.json(result[0]);
    });
});

// ESTADÍSTICAS DOCENTE
app.get('/stats-docente', (req, res) => {
    const qEstudiantes = "SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'Estudiante'";
    const qAlertas = "SELECT COUNT(*) AS total FROM calificaciones WHERE nota < 10";
    const qEvaluaciones = "SELECT COUNT(*) AS total FROM calificaciones";
    db.query(qEstudiantes, (err, resEst) => {
        db.query(qAlertas, (err, resAle) => {
            db.query(qEvaluaciones, (err, resEva) => {
                res.json({
                    estudiantes: resEst[0].total,
                    alertas: resAle[0].total,
                    evaluaciones: resEva[0].total
                });
            });
        });
    });
});

// CONFIGURACIÓN DEL PUERTO PARA HOSTING
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor CEN funcionando en puerto ${PORT}`));
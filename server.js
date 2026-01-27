require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use(express.static(__dirname)); 

// 1. ตั้งค่าการเชื่อมต่อ Database ใข้ dotenv เพื่อดึงค่าจาก .env กันรหัสผ่านหลุด
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect((err) => {
    if (err) {
        console.error('❌ เชื่อมต่อ Database ไม่สำเร็จ:', err);
        return;
    }
    console.log('✅ เชื่อมต่อ MySQL สำเร็จแล้ว!');
});

// 2. API สมัครสมาชิก
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    // 1. เช็คว่ามีอีเมลนี้ไหม
    const sql = "SELECT * FROM users WHERE email = ?";
    db.execute(sql, [email], (err, results) => {
        if (err) return res.json({ status: 'error', message: err });

        // ถ้าหาอีเมลไม่เจอ (Users length เป็น 0)
        if (results.length === 0) {
            return res.json({ 
                status: 'error', 
                target: 'email', // <--- บอกว่าผิดที่ email
                message: 'อีเมลนี้ยังไม่เคยสมัครสมาชิก' 
            });
        }

        // 2. ถ้าเจออีเมล ก็มาเช็ครหัสผ่านต่อ
        const user = results[0];
        // (สมมติว่าคุณใช้ bcrypt.compare ถ้าไม่ได้ใช้ก็เทียบ user.password === password)
        // bcrypt.compare(password, user.password, ...
        if (password !== user.password) { // <-- แก้ตรงนี้ตามวิธีเช็ครหัสของคุณ
            return res.json({ 
                status: 'error', 
                target: 'password', // <--- บอกว่าผิดที่ password
                message: 'รหัสผ่านไม่ถูกต้อง' 
            });
        }

        // 3. ถ้าผ่านหมด
        res.json({ status: 'ok', message: 'Login สำเร็จ', user_id: user.id });
    });
});

// 3. API เข้าสู่ระบบ
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const sql = 'SELECT * FROM users WHERE email = ? AND password = ?';
    db.query(sql, [email, password], (err, results) => {
        if (err) {
            res.status(500).send('Database Error');
        } else if (results.length > 0) {
            res.status(200).json({ message: 'Login successful', user: results[0] });
        } else {
            res.status(401).send('Incorrect email or password');
        }
    });
});

// 4. API รับเรื่องแจ้งซ่อม (Add Request)
app.post('/api/requests', (req, res) => {
    // รับค่าที่ส่งมาจากหน้าเว็บ
    const { user_id, problem_title, building, detail } = req.body;

    // เช็คข้อมูลเบื้องต้น
    if (!user_id || !problem_title || !building) {
        return res.status(400).send('ข้อมูลไม่ครบถ้วน');
    }

    // เตรียมคำสั่ง SQL (สังเกตว่าเราต้องใส่ user_id ด้วย เพื่อให้รู้ว่าใครแจ้ง)
    const sql = `
        INSERT INTO requests (user_id, problem_title, building, detail, status) 
        VALUES (?, ?, ?, ?, 'received')
    `;

    db.query(sql, [user_id, problem_title, building, detail], (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send('บันทึกข้อมูลไม่สำเร็จ');
        } else {
            res.status(200).send('บันทึกข้อมูลเรียบร้อย');
        }
    });
});

// 5. API ดึงรายการแจ้งซ่อมทั้งหมด (Get All Requests)
app.get('/api/requests', (req, res) => {
    // ดึงข้อมูลจากตาราง requests เรียงจากใหม่ไปเก่า
    const sql = 'SELECT * FROM requests ORDER BY created_at DESC';
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Database Error');
        } else {
            // ส่งข้อมูลกลับไปเป็น JSON
            res.json(results);
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 เปิดเว็บได้เลยที่ -> http://localhost:${PORT}`);
});
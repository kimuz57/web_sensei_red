require('dotenv').config();

// 1. IMPORT & SETUP
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const session = require('express-session');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); 
app.use('/uploads', express.static('uploads'));

app.use(session({
    secret: process.env.SESSION_SECRET, // เปลี่ยนเป็นอะไรก็ได้ยาวๆ (หรือใช้ process.env.SESSION_SECRET)
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // ถ้าใช้ https บน Render ให้แก้เป็น true
        maxAge: 24 * 60 * 60 * 1000 // อายุ Session 1 วัน (หน่วย millisecond)
    }
}));

app.post('/api/delete_user', (req, res) => {
    // เช็คว่ามีข้อมูล user ใน session ไหม (แปลว่า Login หรือยัง)
    if (!req.session.user) {
        return res.status(401).send("กรุณา Login ก่อน");
    }
    // เช็ค Role จาก session (ปลอดภัย Hacker แก้ไม่ได้)
    if (req.session.user.role !== 'admin') {
        return res.status(403).send("ห้ามเข้า! คุณไม่ใช่แอดมิน");
    }
});

// 2. CONFIGURATION (ตั้งค่าระบบ)
// ตั้งค่าที่เก็บรูปภาพ
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, 'img-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

//ตั้งค่าอีเมล (Nodemailer)
 Updated upstream
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',  // 👈 ต้องเป็นอันนี้
    port: 587,                     // 👈 ต้องเป็น 587
    secure: false,              // true สำหรับ 465, false สำหรับอื่นๆ

/*const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',  // 👈 ต้องเป็นอันนี้
    port: 465,                     // 👈 ต้องเป็น 587
    secure: true,              // true สำหรับ 465, false สำหรับอื่นๆ
>>>>>>> Stashed changes
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false 
    }
});*/

/*transporter.verify((error, success) => {
    if (error) {
        console.error("เชื่อมต่อ Server อีเมลไม่สำเร็จ:", error);
    } else {
        console.log("Server อีเมลพร้อมใช้งานแล้ว!");
    }
});*/

//เชื่อมต่อ Database
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || //'up_repair_system_v2' //เช็คชื่อ DB ให้ถูก
});
app.use(express.static(__dirname));
db.connect((err) => {
    if (err) console.error('เชื่อมต่อ Database ไม่สำเร็จ:', err);
    else console.log('เชื่อมต่อ MySQL สำเร็จแล้ว');
});

// 3. API ROUTES (ทางเข้าข้อมูล)
//เข้าสู่ระบบ (Login)
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err || results.length === 0) return res.json({ status: 'error', message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
        const user = results[0];
        //ใช้ bcrypt.compare เพื่อเช็ครหัสผ่านที่รับมา กับรหัส Hash ใน DB
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.json({ status: 'error', message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
        }

        res.json({ status: 'ok', user: user });
    });
});

// เปลี่ยนจาก res.redirect เป็น res.json
app.get('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).send("Error");
        
        res.clearCookie('connect.sid'); // ลบ Cookie
        res.json({ status: 'ok' }); // ส่งสัญญาณบอกหน้าบ้านว่า "ออกเรียบร้อย"
    });
});

//แจ้งซ่อม (Add Request)
app.post('/api/requests', upload.single('image'), (req, res) => {
    const { user_id, problem_title, building, detail } = req.body;
    const image_path = req.file ? req.file.filename : null; // รับชื่อไฟล์

    const sql = 'INSERT INTO requests (user_id, problem_title, building, detail, status, image_path) VALUES (?, ?, ?, ?, "received", ?)';
    db.query(sql, [user_id, problem_title, building, detail, image_path], (err) => {
        if (err) return res.status(500).json({ status: 'error', message: 'บันทึกไม่สำเร็จ' });
        res.json({ status: 'ok', message: 'แจ้งซ่อมสำเร็จ' });
    });
});

//ดึงรายการแจ้งซ่อม จาก Database
app.get('/api/requests', (req, res) => {
    const sql = `SELECT requests.*, users.first_name, users.last_name 
                 FROM requests JOIN users ON requests.user_id = users.id 
                 ORDER BY requests.created_at DESC`;
    db.query(sql, (err, results) => {
        if (err) res.status(500).send('Database Error');
        else res.json(results);
    });
});

// Admin อัปเดตสถานะ & ส่งเมลแจ้งจบงาน

app.put('/api/requests/:id/status', (req, res) => {
    const { status } = req.body;
    const requestId = req.params.id;

    // 1. อัปเดตสถานะลง Database
    db.query('UPDATE requests SET status = ? WHERE id = ?', [status, requestId], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ status: 'error', message: 'Database Error' });
        }

        // 2. เช็คว่าถ้าสถานะเป็น "เสร็จสิ้น" (completed) ให้ส่งเมล
        if (status === 'completed') {

            // ดึงข้อมูลอีเมลผู้ใช้ จากตาราง requests เชื่อมกับ users
            const sqlGetUser = `
                SELECT users.email, users.first_name 
                FROM requests 
                JOIN users ON requests.user_id = users.id 
                WHERE requests.id = ?
            `;

            db.query(sqlGetUser, [requestId], (e, rows) => {
                if (!e && rows.length > 0) {
                    const userEmail = rows[0].email;
                    const userName = rows[0].first_name;
                    
                    // แก้เลข IP ตรงนี้ให้เป็นของเครื่องตัวเองนะครับเพื่อให้กดจากมือถือได้ที่อยู่ในแลนวงเดียวกัน (ถ้าเทสแค่ในคอมก็ใช้ localhost ก็ได้)
                    // เช่น http://192.168.1.180:3000 หรือถ้าเทสแค่ในคอมใช้ http://localhost:3000 ก็ได้
                    const webLink = `https://repair-up.onrender.com`; // ใช้บน Server จริง

                    // ส่งอีเมล
                    transporter.sendMail({
                        from: `ระบบแจ้งซ่อม <${process.env.EMAIL_USER}>`,
                        to: userEmail,
                        subject: '✅ งานซ่อมที่คุณแจ้งเข้ามาเสร็จสิ้นแล้ว (กรุณารีวิว)',
                        html: `
                            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px; max-width: 500px;">
                                <h2 style="color: #2e7d32;">งานซ่อมเสร็จสิ้นแล้ว!</h2>
                                <p>สวัสดีคุณ <strong>${userName}</strong>,</p>
                                <p>งานแจ้งซ่อมของคุณได้รับการแก้ไขเรียบร้อยแล้ว</p>
                                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                                <p>กรุณากดลิงก์ด้านล่างเพื่อตรวจสอบความเรียบร้อย และให้คะแนนความพึงพอใจ:</p>
                                
                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="${webLink}" style="background-color: #6a1b9a; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                                        ⭐ ไปที่หน้าเว็บเพื่อรีวิว
                                    </a>
                                </div>
                                
                                <p style="color: #888; font-size: 12px;">หากกดปุ่มไม่ได้ ให้คลิกที่นี่: <a href="${webLink}">${webLink}</a></p>
                            </div>
                        `
                    }, (mailErr, info) => {
                        if (mailErr) console.log("❌ ส่งเมลไม่ผ่าน:", mailErr);
                        else console.log("✅ ส่งเมลเรียบร้อย:", info.response);
                    });
                }
            });
        }

        // ตอบกลับ Frontend ว่าเรียบร้อย
        res.json({ status: 'ok', message: 'อัปเดตสถานะสำเร็จ' });
    });
});
//รีวิว (Review)
app.post('/api/review', (req, res) => {
    const { request_id, rating, review_comment } = req.body;
    const sql = 'UPDATE requests SET rating = ?, review_comment = ? WHERE id = ?';
    db.query(sql, [rating, review_comment, request_id], (err) => {
        if (err) return res.status(500).json({ status: 'error' });
        res.json({ status: 'ok', message: 'ขอบคุณสำหรับการรีวิว!' });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
require('dotenv').config();

// 1. IMPORT & SETUP
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); 
app.use('/uploads', express.static('uploads'));

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
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // ใช้ false สำหรับ port 587
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    // 👇 เพิ่มก้อนนี้เข้าไปครับ สำคัญมากบน Cloud
    tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3'
    },
    // 👇 เพิ่ม Connection Timeout (ถ้าเกิน 10 วิ ให้ตัดเลยจะได้ไม่รอเก้อ)
    connectionTimeout: 10000 
});

transporter.verify((error, success) => {
    if (error) {
        console.error("❌ เชื่อมต่อ Server อีเมลไม่สำเร็จ:", error);
    } else {
        console.log("✅ Server อีเมลพร้อมใช้งานแล้ว!");
    }
});

//เชื่อมต่อ Database
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'up_repair_system' //เช็คชื่อ DB ให้ถูกนะครับ
});
app.use(express.static(__dirname));
db.connect((err) => {
    if (err) console.error('เชื่อมต่อ Database ไม่สำเร็จ:', err);
    else console.log('เชื่อมต่อ MySQL สำเร็จแล้ว');
});

// 3. API ROUTES (ทางเข้าข้อมูล)
//สมัครสมาชิก
app.post('/api/signup', (req, res) => {
    const { email, password, first_name, last_name } = req.body;
    
    // 1. เช็คอีเมลซ้ำ
    db.query('SELECT email FROM users WHERE email = ?', [email], (err, results) => {
        if (err) return res.json({ status: 'error', message: err.message });
        if (results.length > 0) return res.json({ status: 'error', message: 'อีเมลนี้ถูกใช้งานแล้ว' });

        // 2. สร้าง Token
        const token = crypto.randomBytes(32).toString('hex');

        // 3. บันทึก
        const sql = 'INSERT INTO users (email, password, first_name, last_name, verification_token, is_verified) VALUES (?, ?, ?, ?, ?, 0)';
        
        db.query(sql, [email, password, first_name, last_name, token], (err, result) => {
            if (err) return res.json({ status: 'error', message: 'สมัครสมาชิกไม่สำเร็จ' });

            // 4. ส่งอีเมล
            // ⚠️ จุดที่ต้องแก้: ถ้าเทสในเครื่องใช้ localhost, ถ้าขึ้น Server ใช้ URL ของ Render
            // const BASE_URL = 'http://localhost:3000'; 
            const BASE_URL = 'https://repair-up.onrender.com'; // ใช้บน Server จริง
            const verifyLink = `${BASE_URL}/verify?token=${token}`;

            const mailOptions = {
                // 🛠️ แก้ตรงนี้: ใช้ชื่อ Gmail ของเราเป็นผู้ส่ง
                from: `ระบบแจ้งซ่อม <${process.env.EMAIL_USER}>`, 
                to: email,
                subject: '📧 ยืนยันการสมัครสมาชิก',
                html: `
                    <h3>ยินดีต้อนรับคุณ ${first_name}</h3>
                    <p>กรุณากดลิงก์เพื่อยืนยันตัวตน:</p>
                    <a href="${verifyLink}" style="background: #6a1b9a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">ยืนยันอีเมล</a>
                `
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log('❌ ส่งเมลไม่ผ่าน:', error); 
                    // แจ้ง User ว่าสมัครได้แต่ส่งเมลไม่ได้ (อาจจะให้กดส่งใหม่ทีหลัง)
                    return res.json({ status: 'ok', message: 'สมัครสำเร็จ แต่ส่งอีเมลล้มเหลว (กรุณาติดต่อแอดมินหรือลองใหม่)' });
                }
                console.log('✅ ส่งเมลสำเร็จ:', info.response);
                res.json({ status: 'ok', message: 'สมัครสำเร็จ! กรุณาเช็คอีเมลเพื่อยืนยันตัวตน' });
            });
        });
    });
});

//เข้าสู่ระบบ (Login)
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err || results.length === 0) return res.json({ status: 'error', message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });

        const user = results[0];
        if (password !== user.password) return res.json({ status: 'error', message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });

        //เช็คยืนยันตัวตน
        if (user.is_verified === 0) {
            return res.json({ 
                status: 'error', 
                message: 'กรุณายืนยันอีเมลก่อนเข้าใช้งาน',
                needs_verify: true // ส่งรหัสบอกหน้าบ้านให้โชว์ปุ่ม Resend
            });
        }

        res.json({ status: 'ok', user: user });
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
                        from: 'ระบบแจ้งซ่อม <no-reply@up.ac.th>',
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

//กดลิงก์ยืนยันอีเมล (Verify Link)
app.get('/verify', (req, res) => {
    const token = req.query.token;
    if (!token) return res.send('<h1>❌ ลิงก์ไม่ถูกต้อง</h1>');

    const updateSql = 'UPDATE users SET is_verified = 1, verification_token = NULL WHERE verification_token = ?';
    db.query(updateSql, [token], (err, result) => {
        if (err || result.affectedRows === 0) return res.send('<h1>❌ ลิงก์หมดอายุ หรือถูกใช้งานไปแล้ว</h1>');
        res.send(`
            <div style="text-align:center; padding:50px; font-family:sans-serif;">
                <h1 style="color:#2e7d32;">✅ ยืนยันสำเร็จ!</h1>
                <p>บัญชีของคุณเปิดใช้งานแล้ว</p>
                <a href="https://repair-up.onrender.com" style="background:#6a1b9a; color:white; padding:10px 20px; text-decoration:none; border-radius:5px;">เข้าสู่ระบบ</a>
            </div>
        `);
    });
});

//ส่งอีเมลยืนยันซ้ำ
app.post('/api/resend-verification', (req, res) => {
    const { email } = req.body;
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (results.length === 0) return res.json({ status: 'error', message: 'ไม่พบอีเมล' });

        const user = results[0];
        if (user.is_verified === 1) return res.json({ status: 'error', message: 'ยืนยันไปแล้ว' });

        const verifyLink = `https://repair-up.onrender.com/verify?token=${user.verification_token}`;
        transporter.sendMail({
            from: 'ระบบแจ้งซ่อม', to: email, subject: 'ยืนยันอีเมล (ส่งซ้ำ)',
            html: `<a href="${verifyLink}">คลิกยืนยันอีเมล</a>`
        }, (error) => {
             if (error) return res.json({ status: 'error' });
             res.json({ status: 'ok', message: 'ส่งอีเมลใหม่แล้ว!' });
        });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
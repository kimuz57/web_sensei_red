require('dotenv').config();
// const BASE_URL = "https://repair-up.onrender.com"; // เปลี่ยนเป็น URL จริงเมื่อขึ้น Server
const BASE_URL = "http://localhost:3000"; // สำหรับทดสอบบนเครื่องตัวเอง
// 1. IMPORT & SETUP
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt'); // ปิดไว้ชั่วคราวเพราะ DB เก็บพาสเวิร์ดแบบปกติ
const session = require('express-session');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // เพิ่มเพื่อรองรับ Form Data
app.use(express.static(__dirname)); 
app.use('/uploads', express.static('uploads'));

const SibApiV3Sdk = require('sib-api-v3-sdk');
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.EMAIL_PASSWORD; // ✅ ใช้ API Key จาก .env (ตามที่คุณตั้งค่าไว้)
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

// ตั้งค่า Session
app.set('trust proxy', 1);
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        // secure: false, // ถ้าขึ้น Server จริง (https) ให้แก้เป็น true
        secure: process.env.NODE_ENV === 'production', 
        sameSite: 'lax', 
        maxAge: 24 * 60 * 60 * 1000 
    }
}));

// 2. CONFIGURATION
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

// เชื่อมต่อ Database (อัปเดตชื่อ DB ตาม SQL ใหม่)
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: 'up_repair_system_v2' // 👈 เปลี่ยนชื่อ DB ตรงนี้
});

db.connect((err) => {
    if (err) console.error('เชื่อมต่อ Database ไม่สำเร็จ:', err);
    else console.log('เชื่อมต่อ MySQL (up_repair_system_v2) สำเร็จแล้ว');
});

// 3. API ROUTES

// --- เข้าสู่ระบบ (Login) ---
// ส่วน Login (แก้ไขให้รองรับ Hash ที่คุณเพิ่งทำ)
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    // 1. ดึงข้อมูล User จาก Email
    // ⚠️ สังเกตตรงนี้: ต้องมีคำว่า async หน้า (err, results)
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ status: 'error', message: 'Database Error' });
        }

        if (results.length === 0) {
            return res.json({ status: 'error', message: 'อีเมลไม่ถูกต้อง' });
        }

        const user = results[0];

        // 2. เช็คว่ารหัสผ่านใน DB เป็น Hash หรือไม่?
        // (เผื่อบางคนยังไม่ได้รันสคริปต์ Hash จะได้ Login ได้ทั้งคู่)
        let isMatch = false;

        if (user.password.startsWith('$2')) {
            // กรณีเป็น Hash (แบบที่คุณเพิ่งทำ) -> ใช้ bcrypt.compare
            // ⚠️ ต้องมี await ข้างหน้า
            isMatch = await bcrypt.compare(password, user.password);
        } else {
            // กรณีเป็น Text ธรรมดา (เผื่อ Database ยังไม่แก้) -> เช็คตรงๆ
            isMatch = (password === user.password);
        }

        if (!isMatch) {
            return res.json({ status: 'error', message: 'รหัสผ่านไม่ถูกต้อง' });
        }

        // 3. Login สำเร็จ -> เก็บ Session
        req.session.user = user;
        res.json({ status: 'ok', user: user });
    });
});
 
// --- ออกจากระบบ (Logout) ---
app.get('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).send("Error");
        res.clearCookie('connect.sid');
        res.json({ status: 'ok' });
    });
});

// --- แจ้งซ่อม (Add Request) ---
// * แก้ไข: รองรับการแยกตาราง requests และ request_images *
app.post('/api/requests', upload.single('image'), (req, res) => {
    // รับ building_id แทน building name (Frontend ต้องส่ง id 1,2,3,4 มา)
    const { user_id, problem_title, building_id, contact, detail } = req.body;
    const filename = req.file ? req.file.filename : null;

    // 1. Insert ลงตาราง requests (Default status_id = 1 คือ received)
    const sqlRequest = 'INSERT INTO requests (user_id, problem_title, building_id, contact, detail, status_id) VALUES (?, ?, ?, ?, ?, ?)';
    
    db.query(sqlRequest, [user_id, problem_title, building_id, contact, detail, 1], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ status: 'error', message: 'บันทึกข้อมูลไม่สำเร็จ' });
        }

        const requestId = result.insertId; // ได้ ID ของงานซ่อมที่เพิ่งสร้าง

        // 2. ถ้ามีรูปภาพ ให้ Insert ลงตาราง request_images
        if (filename) {
            const sqlImage = 'INSERT INTO request_images (request_id, image_path) VALUES (?, ?)';
            db.query(sqlImage, [requestId, filename], (errImg) => {
                if (errImg) console.error('บันทึกรูปภาพไม่สำเร็จ', errImg);
            });
        }

        res.json({ status: 'ok', message: 'แจ้งซ่อมสำเร็จ' });
    });
});

// --- ดึงรายการแจ้งซ่อม (Get All Requests) ---
// * แก้ไข: JOIN ตาราง buildings, statuses, users, request_images *
app.get('/api/requests', (req, res) => {
    const sql = `
        SELECT 
            r.*, 
            u.first_name, u.last_name, 
            b.name AS building_name, 
            s.statuses AS status_name, -- เช็คชื่อฟิลด์ในตาราง statuses ให้ตรง (name หรือ statuses)
            img.image_path,
            
            -- 👇 ส่วนที่เพิ่มเข้ามา (ดึงข้อมูลรีวิว)
            rev.rating,         -- เปลี่ยนชื่อจาก ratting (ใน db) เป็น rating (ให้ใช้ง่าย)
            rev.review_comment             -- ดึงคอมเมนต์
            
        FROM requests r
        JOIN users u ON r.user_id = u.id
        LEFT JOIN buildings b ON r.building_id = b.id
        LEFT JOIN statuses s ON r.status_id = s.id
        LEFT JOIN request_images img ON r.id = img.request_id
        
        -- 👇 เพิ่มบรรทัดนี้เพื่อเชื่อมตารางรีวิว
        LEFT JOIN review rev ON r.id = rev.request_ID  
        
        ORDER BY r.created_at DESC
    `;
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Database Error');
        } else {
            res.json(results);
        }
    });
});

// --- อัปเดตสถานะ (Update Status) ---
// * แก้ไข: แปลง string เป็น status_id *
app.put('/api/requests/:id/status', (req, res) => {
    const { status } = req.body; 
    const requestId = req.params.id;

    // 👇 DEBUG: ดูว่าหน้าบ้านส่งค่าอะไรมา
    console.log(`[DEBUG] Update Request: ID=${requestId}, Status=${status}`);

    let status_id = 1; 
    if (status === 'received') status_id = 1;
    if (status === 'progress') status_id = 2;
    if (status === 'completed') status_id = 3;

    // อัปเดต Database
    const sqlUpdate = 'UPDATE requests SET status_id = ? WHERE id = ?';
    db.query(sqlUpdate, [status_id, requestId], (err, result) => {
        if (err) {
            console.error('Update Error:', err);
            return res.status(500).json({ status: 'error', message: 'Database Error' });
        }

        // 👇 DEBUG: ดูว่าอัปเดต DB สำเร็จไหม
        console.log(`[DEBUG] DB Updated. Next step check status: '${status}' === 'completed'?`);

        // ถ้าสถานะเป็น "เสร็จสิ้น" ให้ส่งเมล
        if (status === 'completed') {
            console.log("[DEBUG] Status is completed. Prepare to send email..."); // 👈 เช็คจุดนี้

            const sqlGetUser = `SELECT users.email, users.first_name FROM requests JOIN users ON requests.user_id = users.id WHERE requests.id = ?`;

            db.query(sqlGetUser, [requestId], (e, rows) => {
                if (!e && rows.length > 0) {
                    const userEmail = rows[0].email;
                    const userName = rows[0].first_name;
                    console.log(`[DEBUG] Found User: ${userEmail}, Name: ${userName}`);

                    // ... (โค้ดสร้าง sendSmtpEmail เดิมของคุณ) ...
                    // ต้องแน่ใจว่า import SibApiV3Sdk ไว้ด้านบนไฟล์แล้ว
                    
                    let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
                    sendSmtpEmail.subject = "งานซ่อมเสร็จสิ้นแล้ว";
                    sendSmtpEmail.htmlContent = `
                        <div style="font-family: 'Sarabun', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #ffffff;">
        
                            <div style="text-align: center; margin-bottom: 20px;">
                                <h2 style="color: #28a745; margin: 0;">งานซ่อมเสร็จแล้ว!</h2>
                            </div>
        
                            <div style="color: #555; font-size: 16px; line-height: 1.6;">
                                <p>เรียนคุณ <strong>${userName}</strong>,</p>
                                <p>รายการแจ้งซ่อมของคุณดำเนินการเรียบร้อยแล้ว ทางทีมงานขอขอบคุณที่ใช้บริการ</p>
                                <p>เพื่อนำไปปรับปรุงการบริการให้ดียิ่งขึ้น รบกวนเวลาสักครู่เพื่อประเมินความพึงพอใจ</p>
                            </div>

                            <div style="text-align: center; margin-top: 30px; margin-bottom: 30px;">
                                <a href="${BASE_URL}" style="
                                    background-color: #28a745; 
                                    color: white; 
                                    padding: 14px 28px; 
                                    text-decoration: none; 
                                    border-radius: 50px; 
                                    font-weight: bold; 
                                    font-size: 16px; 
                                    display: inline-block; 
                                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                                    border: 1px solid #218838;
                                ">
                                    คลิกเพื่อรีวิวงานซ่อม
                                </a>
                            </div>

                            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        
                            <p style="text-align: center; color: #999; font-size: 12px;">
                                หากปุ่มด้านบนไม่ทำงาน สามารถคลิกที่ลิงก์นี้ได้: <br>
                                <a href="${BASE_URL}" style="color: #007bff;">${BASE_URL}</a>
                            </p>
                        </div>
                    `;
                    sendSmtpEmail.sender = { "name": "Repair System", "email": process.env.EMAIL_USER };
                    sendSmtpEmail.to = [{ "email": userEmail, "name": userName }];

                    // ยิง API
                    console.log("[DEBUG] Sending to Brevo...");
                    apiInstance.sendTransacEmail(sendSmtpEmail).then(function(data) {
                        console.log('✅✅✅ Brevo Success! ID:', data.messageId);
                    }, function(error) {
                        console.error('❌❌❌ Brevo Failed:', JSON.stringify(error, null, 2)); // 👈 ดู Error เต็มๆ
                    });
                } else {
                    console.log("[DEBUG] User not found or DB error fetching user.");
                }
            });
        } else {
            console.log("[DEBUG] Status is NOT completed. No email sent.");
        }

        res.json({ status: 'ok', message: 'อัปเดตสถานะสำเร็จ' });
    });
});
// --- รีวิว (Review) ---
// * แก้ไข: Insert ลงตาราง review แยกต่างหาก *
// ใน app.post('/api/review', ...)
app.post('/api/review', (req, res) => {
    const { request_id, rating, review_comment } = req.body;
    
    // ✅ แก้ตรงนี้: เปลี่ยน ratting เป็น rating
    const sql = 'INSERT INTO review (request_ID, rating, review_comment) VALUES (?, ?, ?)';
    
    db.query(sql, [request_id, rating, review_comment], (err) => {
        if (err) {
            console.error('Error saving review:', err);
            return res.status(500).json({ status: 'error', message: 'บันทึกรีวิวไม่สำเร็จ' });
        }
        res.json({ status: 'ok', message: 'ขอบคุณสำหรับการรีวิว!' });
    });
});


console.log("---------------------------------------");
console.log("Checking Environment Variables:");
console.log("User Email:", process.env.EMAIL_USER);
console.log("API Key Length:", process.env.EMAIL_PASSWORD ? process.env.EMAIL_PASSWORD.length : "Not Found ❌");
console.log("---------------------------------------");

// เริ่ม Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
const express = require("express");
const admin = require("firebase-admin");
const bodyParser = require("body-parser");
const cors = require("cors");
const { getMessaging } = require("firebase-admin/messaging"); // ✅ import API mới

const app = express();

const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG_JSON || "{}");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://vdk-nhietdo-chatluongkk-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = admin.database();

app.use(cors());
app.use(bodyParser.json());

let savedTokens = []; // Có thể dùng Realtime DB nếu muốn lưu lâu dài

// ==== API: Lưu token từ client ====
app.post("/save-token", (req, res) => {
    const { token } = req.body;
    if (token && !savedTokens.includes(token)) {
        savedTokens.push(token);
        console.log("✅ Saved new token:", token);
        res.send({ success: true });
    } else {
        res.status(400).send({ success: false, message: "Token không hợp lệ hoặc đã tồn tại" });
    }
});

app.get("/env-check", (req, res) => {
    const value = process.env.FIREBASE_CONFIG_JSON;
    if (value) {
      res.send("✅ Biến môi trường đã được load.");
    } else {
      res.send("❌ Không tìm thấy biến môi trường.");
    }
  });
  

// ==== Theo dõi thay đổi từ Firebase ====
const dangerRef = db.ref("control/danger");

dangerRef.on("value", (snapshot) => {
    const data = snapshot.val();
    console.log("🌡️ New danger state:", data);

    for (const key in data) {
        if (data[key] === true) {
            const message = `${key.toUpperCase()} báo nguy hiểm!`;
            sendPushNotification(message);
        }
    }
});

// ==== Gửi push notification (với firebase-admin v13+) ====
function sendPushNotification(message) {
    if (savedTokens.length === 0) {
        console.warn("⚠️ Không có device token để gửi!");
        return;
    }

    const notification = {
        title: "Cảnh báo môi trường",
        body: message,
    };

    const payload = {
        tokens: savedTokens,
        notification,
    };

    getMessaging()
        .sendEachForMulticast(payload)
        .then((response) => {
            console.log(`📨 Gửi thông báo: ${response.successCount} thành công / ${savedTokens.length} thiết bị.`);
            if (response.failureCount > 0) {
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        console.warn(`❌ Token lỗi: ${savedTokens[idx]}`);
                        console.error(resp.error.message);
                    }
                });
            }
        })
        .catch((error) => {
            console.error("❌ Lỗi khi gửi notification:", error);
        });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Push server đang chạy tại http://localhost:${PORT}`);
});

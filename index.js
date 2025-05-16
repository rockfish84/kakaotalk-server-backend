require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const admin = require('firebase-admin');

// 서비스 계정 JSON 로드
const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
});

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 메모리 저장소 (실제론 DB 사용 권장)
const deviceTokens = new Set();

// 토큰 등록
app.post('/register-token', (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token is required' });
    deviceTokens.add(token);
    console.log('Registered token:', token);
    res.json({ success: true });
});

// 토큰 목록 조회 (프론트용)
app.get('/tokens', (req, res) => {
    res.json({ tokens: Array.from(deviceTokens) });
});

// 푸시 발송
app.post('/send', async (req, res) => {
    const { type, content, emoticonRes } = req.body;
    if (deviceTokens.size === 0) {
        return res.status(400).json({ error: 'No device tokens registered' });
    }

    const message = {
        tokens: Array.from(deviceTokens),
        data: { type, content, emoticonRes: emoticonRes || '' },
        android: {
            priority: 'high'    // ← High priority 지정
        }
    };

    try {
        const response = await admin.messaging().sendMulticast(message);
        console.log('FCM response:', response);
        res.json({ success: true, response });
    } catch (err) {
        console.error('Error sending FCM:', err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`FCM server listening on port ${PORT}`);
});

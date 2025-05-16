require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const admin = require('firebase-admin');

// 1) 서비스 계정 JSON 로드
const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);

// 2) (안전장치) 프로젝트 ID 하드코딩
const PROJECT_ID = 'kakaotall-33df9';

// 3) Admin SDK 초기화
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID
});
console.log('🔍 Initialized with projectId =', admin.app().options.projectId);

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 4) 인-메모리 토큰 저장소
const deviceTokens = new Set();

// 5) 토큰 등록
app.post('/register-token', (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token is required' });
    deviceTokens.add(token);
    console.log('✅ Registered token:', token);
    res.json({ success: true });
});

// 6) 토큰 조회
app.get('/tokens', (req, res) => {
    res.json({ tokens: Array.from(deviceTokens) });
});

// 7) 푸시 발송 (개별 전송 우회 버전)
app.post('/send', async (req, res) => {
    const { type, content, emoticonRes } = req.body;
    const tokens = Array.from(deviceTokens);
    if (tokens.length === 0) {
        return res.status(400).json({ error: 'No device tokens registered' });
    }

    // 8) 개별 메시지 생성
    const messages = tokens.map(token => ({
        token,
        data: { type, content, emoticonRes: emoticonRes || '' },
        android: { priority: 'high' }
    }));

    try {
        // 9) 모두 Promise로 전송, settled 상태로 결과 집계
        const results = await Promise.allSettled(
            messages.map(msg => admin.messaging().send(msg))
        );

        let successCount = 0, failureCount = 0;
        const responses = results.map((r, i) => {
            if (r.status === 'fulfilled') {
                successCount++;
                return { token: tokens[i], result: r.value };
            } else {
                failureCount++;
                console.error('❌ send error for', tokens[i], r.reason);
                return { token: tokens[i], error: r.reason.message || r.reason };
            }
        });

        console.log(`✅ send all done: ${successCount} success, ${failureCount} failure`);
        return res.json({ success: true, successCount, failureCount, responses });
    } catch (err) {
        console.error('❌ Unexpected error in /send:', err);
        return res.status(500).json({ error: err.message, code: err.code });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 FCM server listening on port ${PORT}`);
});

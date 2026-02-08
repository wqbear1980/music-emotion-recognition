// 测试数据库插入操作
const testData = {
  fileName: "test-music.m4a",
  fileKey: "test-key",
  fileSize: 1024000,
  duration: 180,
  bpm: 120,
  summary: "测试总结",
  filmType: "动作片",
  emotionTags: ["欢快", "紧张"],
  filmScenes: ["追逐", "打斗"],
  scenarios: ["追逐"],
  instruments: ["钢琴", "鼓"],
  styles: ["流行"],
  album: "测试专辑",
  otherFeatures: {
    structure: "测试结构",
    harmony: "测试和声"
  },
  candidateTerms: {
    scenarios: [
      {
        term: "测试词",
        synonyms: ["近义词"],
        filmTypes: ["动作片"],
        confidence: 85,
        reason: "测试理由"
      }
    ]
  },
  sourceType: "album",
  filmName: "测试电影",
  filmScene: "第1集",
  creators: {
    composer: ["测试作曲"],
    singer: ["测试演唱"]
  },
  publisher: "测试发行方",
  platform: "测试平台",
  confidence: "medium",
  confidenceReason: "测试置信度理由",
  metadata: {
    title: "测试标题",
    artist: "测试艺术家",
    album: "测试专辑",
    year: 2024
  }
};

console.log("测试数据:", JSON.stringify(testData, null, 2));

// 尝试调用API插入数据
fetch('http://localhost:5000/api/music-analyses', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(testData)
})
.then(response => response.json())
.then(data => console.log("插入结果:", JSON.stringify(data, null, 2)))
.catch(error => console.error("插入失败:", error));

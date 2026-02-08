#!/usr/bin/env node

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/term-management/get-dynamic-vocabulary',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('✅ JSON 解析成功');
      console.log('Success:', parsed.success);
      console.log('Vocabulary keys:', Object.keys(parsed.data?.vocabulary || {}));
      console.log('Total terms:', parsed.data?.termCount || 0);

      // 检查是否有 standardScenes
      if (parsed.data?.vocabulary?.standardScenes) {
        const scenes = parsed.data.vocabulary.standardScenes;
        console.log('standardScenes has standardize function:', typeof scenes.standardize);
        console.log('standardScenes keys:', Object.keys(scenes));
      }
    } catch (error) {
      console.error('❌ JSON 解析失败:', error.message);
      console.error('Response data (first 500 chars):', data.substring(0, 500));
    }
  });
});

req.on('error', (error) => {
  console.error('请求失败:', error.message);
});

req.end();

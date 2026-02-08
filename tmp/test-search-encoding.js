// 测试前端 URL 编码
const scenarios = ['对峙', '婚外情'];
const params = new URLSearchParams();

params.append('scenarios', scenarios.join(','));

console.log('URL encoded:', params.toString());
console.log('Decoded:', decodeURIComponent(params.toString()));

// 测试 fetch 请求
fetch(`/api/music-analyses/search?${params.toString()}&limit=5&page=1`)
  .then(response => response.json())
  .then(data => {
    console.log('Search result:', data);
  })
  .catch(error => {
    console.error('Search error:', error);
  });

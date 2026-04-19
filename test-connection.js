import fetch from 'node-fetch';

async function testConnection() {
    try {
        const response = await fetch('http://192.168.7.103:5000/manage/gpu');
        const data = await response.json();
        console.log('Connection successful:', data);
    } catch (error) {
        console.error('Connection failed:', error);
    }
}

testConnection();
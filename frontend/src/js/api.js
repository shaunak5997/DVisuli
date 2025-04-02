// frontend/src/js/api.js
async function fetchData() {
    try {
        const response = await fetch('http://localhost:8001/api/data');
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching data:', error);
        return [];
    }
}
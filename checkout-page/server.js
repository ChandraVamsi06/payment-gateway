const express = require('express');
const path = require('path');
const app = express();
const PORT = 80;

app.use(express.static('public'));

// Fix: Handle specific routes instead of wildcard '*' to avoid regex error
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/checkout', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Checkout service running on port ${PORT}`);
});
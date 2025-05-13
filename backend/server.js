const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Ошибка подключения к базе данных:', err);
  } else {
    console.log('Подключено к SQLite базе данных');
  }
});

// Инициализация базы данных
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT UNIQUE,
    status TEXT DEFAULT 'Новый',
    customer TEXT,
    contact_person TEXT,
    order_details TEXT,
    route TEXT,
    extra_field1 TEXT,
    extra_field2 TEXT,
    extra_field3 TEXT,
    extra_field4 TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    type TEXT CHECK(type IN ('history', 'current', 'future')),
    text TEXT,
    date TEXT,
    completed BOOLEAN DEFAULT 0,
    FOREIGN KEY(order_id) REFERENCES orders(id)
  )`);
});

// Валидация статусов
const ALLOWED_STATUSES = ['Новый', 'В работе', 'В пути', 'Доставлен'];

// API для заказов
app.get('/orders', (req, res) => {
  db.all("SELECT * FROM orders ORDER BY created_at DESC", [], (err, rows) => {
    if (err) {
      console.error('Ошибка получения заказов:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.get('/orders/:id', (req, res) => {
  db.get("SELECT * FROM orders WHERE id = ?", [req.params.id], (err, row) => {
    if (err) {
      console.error('Ошибка получения заказа:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(row || {});
  });
});

app.post('/orders', (req, res) => {
  const orderData = req.body;
  
  // Валидация
  if (!orderData.number || !/^[A-Za-z0-9-]+$/.test(orderData.number)) {
    return res.status(400).json({ error: 'Некорректный номер заказа (только буквы, цифры и дефисы)' });
  }

  const orderWithStatus = {
    status: 'Новый',
    ...orderData,
    extra_field1: orderData.extra_field1 || '',
    extra_field2: orderData.extra_field2 || '',
    extra_field3: orderData.extra_field3 || '',
    extra_field4: orderData.extra_field4 || ''
  };

  db.run(
    `INSERT INTO orders (
      number, status, customer, contact_person, order_details, route,
      extra_field1, extra_field2, extra_field3, extra_field4
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderWithStatus.number,
      orderWithStatus.status,
      orderWithStatus.customer,
      orderWithStatus.contact_person,
      orderWithStatus.order_details,
      orderWithStatus.route,
      orderWithStatus.extra_field1,
      orderWithStatus.extra_field2,
      orderWithStatus.extra_field3,
      orderWithStatus.extra_field4
    ],
    function(err) {
      if (err) {
        console.error('Ошибка создания заказа:', err);
        return res.status(500).json({ 
          error: err.message.includes('UNIQUE') 
            ? 'Заказ с таким номером уже существует' 
            : err.message 
        });
      }
      db.get("SELECT * FROM orders WHERE id = ?", [this.lastID], (err, row) => {
        if (err) {
          console.error('Ошибка получения созданного заказа:', err);
          return res.status(500).json({ error: err.message });
        }
        res.json(row);
      });
    }
  );
});

app.put('/orders/:id', (req, res) => {
  const orderData = req.body;
  if (!orderData) {
    return res.status(400).json({ error: 'Данные обязательны' });
  }

  db.run(
    `UPDATE orders SET 
      customer = ?,
      contact_person = ?,
      order_details = ?,
      route = ?,
      extra_field1 = ?,
      extra_field2 = ?,
      extra_field3 = ?,
      extra_field4 = ?
    WHERE id = ?`,
    [
      orderData.customer,
      orderData.contact_person,
      orderData.order_details,
      orderData.route,
      orderData.extra_field1,
      orderData.extra_field2,
      orderData.extra_field3,
      orderData.extra_field4,
      req.params.id
    ],
    function(err) {
      if (err) {
        console.error('Ошибка обновления заказа:', err);
        return res.status(500).json({ error: err.message });
      }
      db.get("SELECT * FROM orders WHERE id = ?", [req.params.id], (err, row) => {
        if (err) {
          console.error('Ошибка получения обновленного заказа:', err);
          return res.status(500).json({ error: err.message });
        }
        res.json(row || {});
      });
    }
  );
});

app.put('/orders/:id/status', (req, res) => {
  const { status } = req.body;
  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Недопустимый статус' });
  }

  db.run(
    "UPDATE orders SET status = ? WHERE id = ?",
    [status, req.params.id],
    function(err) {
      if (err) {
        console.error('Ошибка обновления статуса:', err);
        return res.status(500).json({ error: err.message });
      }
      db.get("SELECT * FROM orders WHERE id = ?", [req.params.id], (err, row) => {
        if (err) {
          console.error('Ошибка получения заказа:', err);
          return res.status(500).json({ error: err.message });
        }
        res.json(row || {});
      });
    }
  );
});

// API для задач
app.get('/orders/:id/tasks', (req, res) => {
  db.all(
    "SELECT * FROM tasks WHERE order_id = ? ORDER BY date",
    [req.params.id],
    (err, tasks) => {
      if (err) {
        console.error('Ошибка получения задач:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json({
        history: tasks.filter(t => t.type === 'history'),
        current: tasks.filter(t => t.type === 'current'),
        future: tasks.filter(t => t.type === 'future')
      });
    }
  );
});

app.post('/orders/:id/tasks', (req, res) => {
  const { text, type, date } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Текст задачи обязателен' });
  }

  db.run(
    "INSERT INTO tasks (order_id, text, type, date) VALUES (?, ?, ?, ?)",
    [req.params.id, text, type || 'current', date || new Date().toISOString()],
    function(err) {
      if (err) {
        console.error('Ошибка создания задачи:', err);
        return res.status(500).json({ error: err.message });
      }
      db.get("SELECT * FROM tasks WHERE id = ?", [this.lastID], (err, row) => {
        if (err) {
          console.error('Ошибка получения созданной задачи:', err);
          return res.status(500).json({ error: err.message });
        }
        res.json(row);
      });
    }
  );
});

app.put('/tasks/:id', (req, res) => {
  const { type } = req.body;
  if (!type || !['history', 'current', 'future'].includes(type)) {
    return res.status(400).json({ error: 'Недопустимый тип задачи' });
  }

  db.run(
    "UPDATE tasks SET type = ? WHERE id = ?",
    [type, req.params.id],
    function(err) {
      if (err) {
        console.error('Ошибка обновления задачи:', err);
        return res.status(500).json({ error: err.message });
      }
      db.get("SELECT * FROM tasks WHERE id = ?", [req.params.id], (err, row) => {
        if (err) {
          console.error('Ошибка получения задачи:', err);
          return res.status(500).json({ error: err.message });
        }
        res.json(row || {});
      });
    }
  );
});

app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
});
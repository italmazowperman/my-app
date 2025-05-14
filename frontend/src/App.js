import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';

const App = () => {
  const API_BASE_URL = 'https://my-app-backend-service.onrender.com';
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [tasks, setTasks] = useState({ history: [], current: [], future: [] });
  const [newOrder, setNewOrder] = useState({
    number: '',
    customer: '',
    contact_person: '',
    order_details: '',
    route: '',
    extra_field1: '',
    extra_field2: '',
    extra_field3: '',
    extra_field4: ''
  });
  const [newTask, setNewTask] = useState({
    text: '',
    type: 'current',
    date: new Date().toISOString().slice(0, 16)
  });
  const [editingTask, setEditingTask] = useState(null);
  const [editingOrder, setEditingOrder] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Проверка мобильного вида
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth <= 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Показ уведомления
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Загрузка данных
  const loadOrders = useCallback(() => {
    setIsLoading(true);
    fetch(`${API_BASE_URL}/orders`)
      .then(res => {
        if (!res.ok) throw new Error('Ошибка загрузки заказов');
        return res.json();
      })
      .then(data => {
        setOrders(data);
        if (selectedOrder && !data.some(o => o.id === selectedOrder)) {
          setSelectedOrder(null);
        }
      })
      .catch(err => {
        console.error('Ошибка:', err);
        showNotification('Не удалось загрузить заказы', 'error');
      })
      .finally(() => setIsLoading(false));
  }, [selectedOrder]);

  const loadTasks = useCallback(() => {
    if (!selectedOrder) return;
    setIsLoading(true);
    fetch(`${API_BASE_URL}/orders/${selectedOrder}/tasks`)
      .then(res => {
        if (!res.ok) throw new Error('Ошибка загрузки задач');
        return res.json();
      })
      .then(setTasks)
      .catch(err => {
        console.error('Ошибка:', err);
        showNotification('Не удалось загрузить задачи', 'error');
      })
      .finally(() => setIsLoading(false));
  }, [selectedOrder]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Фильтрация заказов
  const filteredOrders = useMemo(() => {
    return orders.filter(order => 
      (statusFilter === 'all' || order.status === statusFilter) &&
      (order.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.route?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [orders, searchTerm, statusFilter]);

  // Текущий выбранный заказ
  const currentOrder = useMemo(() => 
    orders.find(o => o.id === selectedOrder), 
    [orders, selectedOrder]
  );

  // Валидация номера заказа
  const validateOrderNumber = (number) => /^[A-Za-z0-9-]+$/.test(number);

  // Создание заказа
  const createOrder = () => {
    if (!newOrder.number.trim()) {
      showNotification('Введите номер заказа!', 'error');
      return;
    }
    
    if (!validateOrderNumber(newOrder.number)) {
      showNotification('Некорректный номер заказа (только буквы, цифры и дефисы)', 'error');
      return;
    }

    fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newOrder)
    })
      .then(res => {
        if (!res.ok) throw new Error('Ошибка создания заказа');
        return res.json();
      })
      .then(createdOrder => {
        setNewOrder({
          number: '',
          customer: '',
          contact_person: '',
          order_details: '',
          route: '',
          extra_field1: '',
          extra_field2: '',
          extra_field3: '',
          extra_field4: ''
        });
        loadOrders();
        setSelectedOrder(createdOrder.id);
        showNotification('Заказ успешно создан');
      })
      .catch(err => {
        console.error('Ошибка:', err);
        showNotification(err.message.includes('UNIQUE') 
          ? 'Заказ с таким номером уже существует' 
          : 'Не удалось создать заказ', 'error');
      });
  };

  // Обновление заказа
  const updateOrder = () => {
    if (!currentOrder) return;

    fetch(`${API_BASE_URL}/orders/${selectedOrder}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentOrder)
    })
      .then(res => {
        if (!res.ok) throw new Error('Ошибка обновления заказа');
        return loadOrders();
      })
      .then(() => {
        setEditingOrder(false);
        showNotification('Данные заказа обновлены');
      })
      .catch(err => {
        console.error('Ошибка:', err);
        showNotification('Не удалось обновить заказ', 'error');
      });
  };

  // Добавление задачи
  const addTask = () => {
    if (!selectedOrder) {
      showNotification('Выберите заказ!', 'error');
      return;
    }
    if (!newTask.text.trim()) {
      showNotification('Введите описание задачи!', 'error');
      return;
    }

    fetch(`${API_BASE_URL}/orders/${selectedOrder}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTask)
    })
      .then(() => {
        setNewTask({ text: '', type: 'current', date: new Date().toISOString().slice(0, 16) });
        showNotification('Задача добавлена');
        return loadTasks();
      })
      .catch(err => {
        console.error('Ошибка:', err);
        showNotification('Не удалось добавить задачу', 'error');
      });
  };

  // Изменение статуса задачи
  const changeTaskStatus = (taskId, newType) => {
    fetch(`${API_BASE_URL}/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: newType })
    })
      .then(() => loadTasks())
      .then(() => showNotification('Статус задачи изменен'))
      .catch(err => {
        console.error('Ошибка:', err);
        showNotification('Не удалось изменить статус задачи', 'error');
      });
  };

  // Изменение статуса заказа
  const updateOrderStatus = (status) => {
    if (!window.confirm(`Изменить статус заказа на "${status}"?`)) return;
    
    fetch(`${API_BASE_URL}/orders/${selectedOrder}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
      .then(() => loadOrders())
      .then(() => showNotification(`Статус изменен на "${status}"`))
      .catch(err => {
        console.error('Ошибка:', err);
        showNotification('Не удалось обновить статус', 'error');
      });
  };

  // Форматирование даты
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    
    if (date.toDateString() === now.toDateString()) {
      return 'Сегодня, ' + date.toLocaleTimeString();
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Вчера, ' + date.toLocaleTimeString();
    }
    
    return date.toLocaleString();
  };

  return (
    <div className={`app-container ${isMobileView ? 'mobile-view' : ''}`}>
      {/* Уведомления */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* Боковая панель */}
      <div className={`orders-panel ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <h2>Список заказов</h2>
          {!isMobileView && (
            <button 
              className="collapse-sidebar-button"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              title={isSidebarCollapsed ? "Показать панель" : "Скрыть панель"}
            >
              {isSidebarCollapsed ? '►' : '◄'}
            </button>
          )}
        </div>

        {!isSidebarCollapsed && (
          <>
            {/* Поиск заказов */}
            <div className="search-box">
              <input
                type="text"
                placeholder="Поиск по номеру, заказчику или маршруту..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Фильтр по статусу */}
            <div className="filter-box">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Все статусы</option>
                <option value="Новый">Новый</option>
                <option value="В работе">В работе</option>
                <option value="В пути">В пути</option>
                <option value="Доставлен">Доставлен</option>
              </select>
            </div>

            {/* Форма создания заказа */}
            <div className="add-order-form">
              <h3>Новый заказ</h3>
              <div className="form-row">
                <input
                  type="text"
                  placeholder="Номер заказа*"
                  value={newOrder.number}
                  onChange={(e) => setNewOrder({...newOrder, number: e.target.value})}
                />
              </div>
              <div className="form-row">
                <input
                  type="text"
                  placeholder="Заказчик"
                  value={newOrder.customer}
                  onChange={(e) => setNewOrder({...newOrder, customer: e.target.value})}
                />
              </div>
              <div className="form-row">
                <input
                  type="text"
                  placeholder="Контактное лицо"
                  value={newOrder.contact_person}
                  onChange={(e) => setNewOrder({...newOrder, contact_person: e.target.value})}
                />
              </div>
              <button onClick={createOrder}>Создать заказ</button>
            </div>

            {/* Список заказов */}
            {isLoading ? (
              <div className="loader">Загрузка...</div>
            ) : (
              <ul className="orders-list">
                {filteredOrders.map(order => (
                  <li
                    key={order.id}
                    className={selectedOrder === order.id ? 'selected' : ''}
                    onClick={() => {
                      setSelectedOrder(order.id);
                      if (isMobileView) {
                        setIsSidebarCollapsed(true);
                      }
                    }}
                  >
                    <div className="order-number">{order.number}</div>
                    <div className="order-status" data-status={order.status}>
                      {order.status}
                    </div>
                    <div className="order-additional">
                      <small>{order.customer}</small>
                      <small>{order.route}</small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {/* Основное содержимое */}
      <div className="main-content">
        {isMobileView && isSidebarCollapsed && (
          <button 
            className="mobile-back-button"
            onClick={() => setIsSidebarCollapsed(false)}
          >
            ◄ Список заказов
          </button>
        )}

        {selectedOrder ? (
          <div className="order-details">
            {isLoading ? (
              <div className="loader">Загрузка...</div>
            ) : editingOrder ? (
              <div className="order-edit-form">
                <h2>Редактирование заказа #{currentOrder?.number}</h2>
                
                {/* Форма редактирования */}
                {Object.entries({
                  customer: 'Заказчик',
                  contact_person: 'Контактное лицо',
                  order_details: 'Детали заказа',
                  route: 'Маршрут',
                  extra_field1: 'Доп. поле 1',
                  extra_field2: 'Доп. поле 2',
                  extra_field3: 'Доп. поле 3',
                  extra_field4: 'Доп. поле 4'
                }).map(([field, label]) => (
                  <div className="form-row" key={field}>
                    <label>{label}:</label>
                    <input
                      value={currentOrder?.[field] || ''}
                      onChange={(e) => {
                        const updatedOrders = orders.map(order => 
                          order.id === selectedOrder 
                            ? {...order, [field]: e.target.value} 
                            : order
                        );
                        setOrders(updatedOrders);
                      }}
                    />
                  </div>
                ))}

                <div className="form-actions">
                  <button onClick={updateOrder}>Сохранить</button>
                  <button onClick={() => setEditingOrder(false)}>Отмена</button>
                </div>
              </div>
            ) : (
              <>
                <div className="order-header">
                  <h2>Заказ #{currentOrder?.number}</h2>
                  <button onClick={() => setEditingOrder(true)}>Редактировать</button>
                </div>
                
                {/* Информация о заказе */}
                <div className={`order-info ${isMobileView ? 'mobile-layout' : ''}`}>
                  <div className="info-block">
                    {Object.entries({
                      customer: 'Заказчик',
                      contact_person: 'Контакт',
                      order_details: 'Детали',
                      route: 'Маршрут'
                    }).map(([field, label]) => (
                      <div className="info-row" key={field}>
                        <span className="info-label">{label}:</span>
                        <span>{currentOrder?.[field] || '-'}</span>
                      </div>
                    ))}
                  </div>
                  <div className="info-block">
                    {[1, 2, 3, 4].map(i => (
                      <div className="info-row" key={i}>
                        <span className="info-label">Доп. поле {i}:</span>
                        <span>{currentOrder?.[`extra_field${i}`] || '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Статусы */}
                <div className="status-actions">
                  {['Новый', 'В работе', 'В пути', 'Доставлен'].map(status => (
                    <button 
                      key={status}
                      onClick={() => updateOrderStatus(status)}
                      disabled={currentOrder?.status === status}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                {/* Задачи */}
                {['history', 'current', 'future'].map(type => (
                  <div className="tasks-section" key={type}>
                    <h3>
                      {type === 'history' ? 'История' : 
                      type === 'current' ? 'Текущие задачи' : 'Будущие задачи'}
                    </h3>
                    <ul>
                      {tasks[type].map(task => (
                        <li className="task-item" key={task.id}>
                          {type !== 'current' && (
                            <span className="task-date">
                              {formatDate(task.date)}
                            </span>
                          )}
                          <span className="task-text">{task.text}</span>
                          <select
                            value={task.type}
                            onChange={(e) => changeTaskStatus(task.id, e.target.value)}
                          >
                            <option value="history">История</option>
                            <option value="current">Текущая</option>
                            <option value="future">Будущая</option>
                          </select>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                {/* Добавление задачи */}
                <div className="add-task">
                  <h3>Добавить задачу</h3>
                  <input
                    type="text"
                    placeholder="Описание задачи"
                    value={newTask.text}
                    onChange={(e) => setNewTask({...newTask, text: e.target.value})}
                  />
                  <select
                    value={newTask.type}
                    onChange={(e) => setNewTask({...newTask, type: e.target.value})}
                  >
                    <option value="current">Текущая</option>
                    <option value="future">Будущая</option>
                  </select>
                  <button onClick={addTask}>Добавить задачу</button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="no-order-selected">
            <p>Выберите заказ из списка или создайте новый</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
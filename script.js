document.addEventListener('DOMContentLoaded', () => {
    const taskInput = document.getElementById('taskInput');
    const addTaskBtn = document.getElementById('addTask');
    const analyzeBtn = document.getElementById('analyzeTask');
    const taskList = document.getElementById('taskList');
    const tasksCount = document.getElementById('tasksCount');
    const clearCompletedBtn = document.getElementById('clearCompleted');
    const filters = document.querySelectorAll('.filter');
    const analysisStatus = document.getElementById('analysisStatus');
    const emptyState = document.getElementById('emptyState');

    const GEMINI_API_KEY = 'AIzaSyAz2VRduUDJR82yaKtAD7yiO_0pBIZdNJs';
    const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];

    function updateEmptyState() {
        if (tasks.length === 0) {
            emptyState.style.display = 'block';
            taskList.style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            taskList.style.display = 'block';
        }
    }

    async function analyzeWithGemini(text) {
        const prompt = `
        قم بتحليل النص التالي وتحويله إلى مهام قابلة للتنفيذ (actionable tasks).
        قم بتقسيم المهام إلى خطوات صغيرة ومحددة.
        أعط النتيجة على شكل قائمة من المهام فقط، كل سطر مهمة واحدة.
        النص: ${text}
        `;

        try {
            analysisStatus.textContent = 'جاري تحليل النص...';
            
            const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }]
                })
            });

            const data = await response.json();
            if (data.candidates && data.candidates[0].content.parts[0].text) {
                const tasks = data.candidates[0].content.parts[0].text
                    .split('\n')
                    .filter(task => task.trim())
                    .map(task => task.replace(/^[-*]\s*/, '').trim());
                return tasks;
            }
            return [];
        } catch (error) {
            console.error('Error analyzing with Gemini:', error);
            return [];
        } finally {
            analysisStatus.textContent = '';
        }
    }

    async function handleAnalyze() {
        const text = taskInput.value.trim();
        if (!text) {
            showNotification('يرجى كتابة نص للتحليل');
            return;
        }

        analyzeBtn.disabled = true;
        analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            const generatedTasks = await analyzeWithGemini(text);
            if (generatedTasks.length > 0) {
                generatedTasks.forEach(taskText => addTask(taskText));
                taskInput.value = '';
                showNotification('تم إنشاء المهام بنجاح!', 'success');
            } else {
                showNotification('لم نتمكن من تحليل النص. حاول صياغته بشكل مختلف.');
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('حدث خطأ أثناء تحليل النص. يرجى المحاولة مرة أخرى.');
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = '<i class="fas fa-brain"></i><span class="button-text">تحليل</span>';
        }
    }

    function showNotification(message, type = 'error') {
        analysisStatus.textContent = message;
        analysisStatus.className = 'analysis-status ' + type;
        setTimeout(() => {
            analysisStatus.textContent = '';
            analysisStatus.className = 'analysis-status';
        }, 3000);
    }

    function saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(tasks));
        updateEmptyState();
    }

    function createTaskElement(task) {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        li.innerHTML = `
            <input type="checkbox" class="checkbox" ${task.completed ? 'checked' : ''}>
            <span class="task-text">${task.text}</span>
            <button class="delete-btn" title="حذف المهمة"><i class="fas fa-trash"></i></button>
        `;

        const checkbox = li.querySelector('.checkbox');
        checkbox.addEventListener('change', () => {
            task.completed = checkbox.checked;
            li.classList.toggle('completed');
            saveTasks();
            updateTasksCount();
        });

        const deleteBtn = li.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => {
            li.classList.add('fade-out');
            li.addEventListener('animationend', () => {
                li.remove();
                tasks = tasks.filter(t => t !== task);
                saveTasks();
                updateTasksCount();
            }, { once: true });
        });

        return li;
    }

    function addTask(text) {
        if (text.trim() === '') {
            showNotification('يرجى كتابة نص المهمة');
            return;
        }
        
        const task = {
            id: Date.now(),
            text: text,
            completed: false
        };

        tasks.push(task);
        const taskElement = createTaskElement(task);
        taskList.appendChild(taskElement);
        saveTasks();
        updateTasksCount();
        taskInput.value = '';
    }

    function updateTasksCount() {
        const remainingTasks = tasks.filter(task => !task.completed).length;
        const totalTasks = tasks.length;
        
        if (totalTasks === 0) {
            tasksCount.textContent = 'لا توجد مهام';
        } else if (remainingTasks === 0) {
            tasksCount.textContent = 'جميع المهام مكتملة';
        } else {
            tasksCount.textContent = remainingTasks === 1 
                ? "مهمة واحدة متبقية"
                : `${remainingTasks} مهام متبقية`;
        }
    }

    function filterTasks(filterType) {
        const taskItems = taskList.getElementsByClassName('task-item');
        
        Array.from(taskItems).forEach(item => {
            switch(filterType) {
                case 'all':
                    item.style.display = '';
                    break;
                case 'active':
                    item.style.display = item.classList.contains('completed') ? 'none' : '';
                    break;
                case 'completed':
                    item.style.display = item.classList.contains('completed') ? '' : 'none';
                    break;
            }
        });
    }

    // Event Listeners
    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            if (taskInput.value.includes('؟') || taskInput.value.length > 50) {
                handleAnalyze();
            } else {
                addTask(taskInput.value);
            }
        }
    });

    analyzeBtn.addEventListener('click', handleAnalyze);
    addTaskBtn.addEventListener('click', () => addTask(taskInput.value));

    clearCompletedBtn.addEventListener('click', () => {
        const completedTasks = tasks.filter(task => task.completed);
        if (completedTasks.length === 0) {
            showNotification('لا توجد مهام مكتملة للحذف');
            return;
        }
        
        tasks = tasks.filter(task => !task.completed);
        saveTasks();
        renderTasks();
        updateTasksCount();
        showNotification('تم حذف المهام المكتملة', 'success');
    });

    filters.forEach(filter => {
        filter.addEventListener('click', () => {
            filters.forEach(f => f.classList.remove('active'));
            filter.classList.add('active');
            filterTasks(filter.dataset.filter);
        });
    });

    function renderTasks() {
        taskList.innerHTML = '';
        tasks.forEach(task => {
            taskList.appendChild(createTaskElement(task));
        });
        updateTasksCount();
        updateEmptyState();
    }

    // Initial render
    renderTasks();
});

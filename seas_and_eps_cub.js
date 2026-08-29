(function() {
    'use strict';

    // Ждем загрузки Lampa
    if (window.appready) {
        init();
    } else {
        document.addEventListener('appready', init);
    }

    // Функция, которая будет вызвана после загрузки приложения
    function init() {
        // Проверяем, что плагин не запущен дважды
        if (window.season_and_ep_plugin_loaded) return;
        window.season_and_ep_plugin_loaded = true;

        console.log('[Season&Eps Plugin] Загружен для cub.black');

        // --- Вспомогательная функция для получения данных через TMDB Proxy ---
        function getTMDbData(url, callback) {
            // Используем стандартный прокси Lampa для обхода ограничений
            // Обратите внимание: Lampa.Utils.putScriptAsync загружает скрипты,
            // а для данных мы используем Lampa.Storage или прямой fetch через прокси.
            // В этом плагине используем Lampa.Utils.fetchProxied или просто fetch с прокси.
            // Так как прокси может быть разным, используем универсальный метод.
            
            // Пробуем использовать встроенный прокси Lampa
            var proxyUrl = Lampa.TMDB.proxy + url;
            
            // Если прокси не задан, используем прямой запрос через Lampa.Utils.fetch
            if (!Lampa.TMDB.proxy) {
                proxyUrl = 'https://api.themoviedb.org/3' + url + '?api_key=' + Lampa.TMDB.api_key() + '&language=' + Lampa.Language.get('language', 'ru');
            }

            Lampa.Utils.fetch(proxyUrl)
                .then(function(response) {
                    return response.json();
                })
                .then(function(data) {
                    callback(data);
                })
                .catch(function(error) {
                    console.error('[Season&Eps Plugin] Ошибка загрузки данных:', error);
                    callback(null);
                });
        }

        // --- Функция для отображения статуса на карточке ---
        function renderStatus(cardElement, data) {
            if (!cardElement || !data) return;

            var statusContainer = cardElement.querySelector('.season-ep-status');
            if (statusContainer) {
                statusContainer.remove();
            }

            var posterContainer = cardElement.querySelector('.poster-container') || cardElement;
            var statusDiv = document.createElement('div');
            statusDiv.className = 'season-ep-status';
            statusDiv.style.cssText = `
                position: absolute;
                bottom: 10px;
                left: 10px;
                background: rgba(0, 0, 0, 0.8);
                color: #fff;
                padding: 2px 10px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 10;
                pointer-events: none;
                font-weight: bold;
            `;

            var text = '';
            // Проверяем, есть ли данные о сезонах
            if (data.lastSeason && data.lastEpisode) {
                text = 'S' + data.lastSeason + ' / E' + data.lastEpisode;
            } else if (data.status) {
                // Если сериал завершен или закрыт
                if (data.status.toLowerCase().includes('ended')) {
                    text = 'Завершён';
                } else if (data.status.toLowerCase().includes('canceled')) {
                    text = 'Закрыт';
                } else if (data.status.toLowerCase().includes('returning')) {
                    text = 'Идёт';
                } else {
                    text = data.status;
                }
            } else {
                return;
            }

            statusDiv.textContent = text;
            posterContainer.style.position = 'relative';
            posterContainer.appendChild(statusDiv);
        }

        // --- Основная функция для обработки карточки ---
        function processCard(card) {
            var cardData = card.dataset;
            // Проверяем, что это сериал
            if (cardData.type !== 'serial') return;

            var itemId = cardData.id;
            if (!itemId) return;

            // Проверяем, есть ли уже данные о сезонах в атрибутах карточки
            if (cardData.lastSeason && cardData.lastEpisode) {
                renderStatus(card, {
                    lastSeason: parseInt(cardData.lastSeason),
                    lastEpisode: parseInt(cardData.lastEpisode),
                    status: cardData.status
                });
                return;
            }

            // Если данных нет, запрашиваем через TMDB API
            // Используем ID из карточки
            var tmdbId = cardData.tmdb_id || itemId;
            
            // Запрашиваем информацию о сериале
            getTMDbData('/tv/' + tmdbId, function(data) {
                if (!data) return;

                var seasons = data.seasons || [];
                var lastSeasonData = null;
                var lastSeasonNumber = 0;
                var lastEpisodeNumber = 0;

                // Ищем последний сезон, который уже вышел
                for (var i = 0; i < seasons.length; i++) {
                    var season = seasons[i];
                    if (season.season_number > 0 && season.episode_count > 0) {
                        // Если это последний сезон или сезон с наибольшим номером
                        if (season.season_number > lastSeasonNumber) {
                            lastSeasonNumber = season.season_number;
                            lastSeasonData = season;
                        }
                    }
                }

                // Если нашли последний сезон, берем количество эпизодов
                if (lastSeasonData) {
                    lastEpisodeNumber = lastSeasonData.episode_count;
                }

                // Получаем статус сериала
                var status = data.status || '';

                // Сохраняем данные в атрибуты карточки, чтобы не запрашивать повторно
                card.dataset.lastSeason = lastSeasonNumber;
                card.dataset.lastEpisode = lastEpisodeNumber;
                card.dataset.status = status;

                renderStatus(card, {
                    lastSeason: lastSeasonNumber,
                    lastEpisode: lastEpisodeNumber,
                    status: status
                });
            });
        }

        // --- Функция для обработки всех карточек на странице ---
        function processAllCards() {
            var cards = document.querySelectorAll('.card');
            cards.forEach(function(card) {
                processCard(card);
            });
        }

        // --- Наблюдатель за изменениями в DOM ---
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length) {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1 && node.matches && node.matches('.card')) {
                            processCard(node);
                        }
                        // Если добавился целый контейнер с карточками
                        if (node.nodeType === 1 && node.querySelectorAll) {
                            var cards = node.querySelectorAll('.card');
                            cards.forEach(function(card) {
                                processCard(card);
                            });
                        }
                    });
                }
            });
        });

        // Запускаем наблюдение за изменениями в body
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Обрабатываем уже существующие карточки
        setTimeout(processAllCards, 500);
    }
})();

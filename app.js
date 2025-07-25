// ThermoSense React Application - Comprehensive Battery Health Monitoring
const { useState, useEffect, useContext, createContext, useRef, useCallback, useMemo } = React;

// Context for global application state
const ThermoSenseContext = createContext();

// Custom hook for battery monitoring
const useBattery = () => {
  const [batteryData, setBatteryData] = useState(null);
  const [batteryStatus, setBatteryStatus] = useState('disconnected');
  const [retryCount, setRetryCount] = useState(0);
  const batteryRef = useRef(null);

  const initializeBattery = useCallback(async () => {
    try {
      if ('getBattery' in navigator) {
        const battery = await navigator.getBattery();
        batteryRef.current = battery;
        
        const updateBatteryData = () => {
          setBatteryData({
            level: Math.round(battery.level * 100),
            charging: battery.charging,
            chargingTime: battery.chargingTime,
            dischargingTime: battery.dischargingTime,
            lastUpdate: new Date()
          });
        };
        
        battery.addEventListener('chargingchange', updateBatteryData);
        battery.addEventListener('levelchange', updateBatteryData);
        battery.addEventListener('chargingtimechange', updateBatteryData);
        battery.addEventListener('dischargingtimechange', updateBatteryData);
        
        updateBatteryData();
        setBatteryStatus('connected');
        return { success: true };
      } else {
        setBatteryStatus('disconnected');
        setBatteryData({
          level: 85,
          charging: Math.random() > 0.5,
          chargingTime: 7200,
          dischargingTime: 14400,
          lastUpdate: new Date(),
          simulated: true
        });
        return { success: false, error: 'Battery API not supported - using simulated data' };
      }
    } catch (error) {
      setBatteryStatus('disconnected');
      setBatteryData({
        level: 75,
        charging: false,
        chargingTime: Infinity,
        dischargingTime: 18000,
        lastUpdate: new Date(),
        simulated: true
      });
      return { success: false, error: error.message };
    }
  }, []);

  const retryBattery = useCallback(async () => {
    setRetryCount(prev => prev + 1);
    setBatteryStatus('retrying');
    const result = await initializeBattery();
    if (!result.success) {
      setBatteryStatus('disconnected');
    }
    return result;
  }, [initializeBattery]);

  return { batteryData, batteryStatus, initializeBattery, retryBattery };
};

// Custom hook for weather data
const useWeather = () => {
  const [weatherData, setWeatherData] = useState(null);
  const [weatherStatus, setWeatherStatus] = useState('disconnected');
  const [location, setLocation] = useState(null);

  const fetchWeather = useCallback(async (lat, lon) => {
    try {
      setWeatherStatus('retrying');
      const response = await axios.get(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,uv_index&timezone=auto`,
        { timeout: 10000 }
      );
      
      const data = response.data;
      const weatherInfo = {
        temperature: data.current.temperature_2m,
        humidity: data.current.relative_humidity_2m,
        windSpeed: data.current.wind_speed_10m,
        weatherCode: data.current.weather_code,
        uvIndex: data.current.uv_index || 0,
        lastUpdate: new Date()
      };
      
      setWeatherData(weatherInfo);
      setWeatherStatus('connected');
      return { success: true, data: weatherInfo };
    } catch (error) {
      setWeatherStatus('disconnected');
      return { success: false, error: error.message };
    }
  }, []);

  const getLocationAndWeather = useCallback(async () => {
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 600000
        });
      });
      
      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      });
      
      return await fetchWeather(position.coords.latitude, position.coords.longitude);
    } catch (error) {
      setWeatherStatus('disconnected');
      const fallbackWeather = {
        temperature: 22.5,
        humidity: 65,
        windSpeed: 3.2,
        weatherCode: 1,
        uvIndex: 3,
        fallback: true,
        lastUpdate: new Date()
      };
      setWeatherData(fallbackWeather);
      return { success: false, error: error.message, data: fallbackWeather };
    }
  }, [fetchWeather]);

  const retryWeather = useCallback(async () => {
    if (location) {
      return await fetchWeather(location.latitude, location.longitude);
    } else {
      return await getLocationAndWeather();
    }
  }, [location, fetchWeather, getLocationAndWeather]);

  return { weatherData, weatherStatus, getLocationAndWeather, retryWeather };
};

// Custom hook for device performance monitoring
const useDevicePerformance = () => {
  const [performanceData, setPerformanceData] = useState({});
  
  const updatePerformance = useCallback(() => {
    const performance = window.performance;
    
    let memoryInfo = {};
    if (performance.memory) {
      memoryInfo = {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)
      };
    } else {
      memoryInfo = {
        used: Math.round(45.6 + Math.random() * 10),
        total: 128
      };
    }
    
    let networkInfo = {};
    if (navigator.connection) {
      networkInfo = {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink
      };
    } else {
      networkInfo = {
        effectiveType: 'wifi',
        downlink: 10
      };
    }
    
    const cpuLoad = Math.min(100, Math.max(0, Math.random() * 40 + 15));
    
    setPerformanceData({
      memory: memoryInfo,
      network: networkInfo,
      cpuLoad: Math.round(cpuLoad),
      cores: navigator.hardwareConcurrency || 8,
      timestamp: new Date()
    });
  }, []);

  return { performanceData, updatePerformance };
};

// ML Model for battery health analysis
const useMLModel = () => {
  const coefficients = {
    temperatureWeight: -0.12,
    usageWeight: -0.08,
    ageWeight: -0.05,
    chargingCycleWeight: -0.03,
    intercept: 100
  };

  const generateRecommendations = useCallback((batteryData, weatherData, deviceTemp, performanceData, thresholds) => {
    const recommendations = [];
    let healthScore = 100;
    let alertLevel = 'safe';

    if (deviceTemp > thresholds.tempCritical) {
      recommendations.push("🚨 CRITICAL: Device temperature too high! Cool down immediately!");
      healthScore -= 25;
      alertLevel = 'danger';
    } else if (deviceTemp > thresholds.tempWarning) {
      recommendations.push("⚠️ WARNING: Device running hot. Reduce intensive tasks.");
      healthScore -= 15;
      alertLevel = 'warning';
    } else {
      recommendations.push("✅ Temperature levels are optimal.");
    }

    if (batteryData) {
      if (batteryData.charging && deviceTemp > thresholds.tempWarning) {
        recommendations.push("⚠️ Charging while hot affects battery longevity.");
        healthScore -= 10;
        if (alertLevel === 'safe') alertLevel = 'warning';
      } else if (batteryData.charging) {
        recommendations.push("🔋 Charging conditions are good.");
      }
      
      if (batteryData.level < thresholds.batteryLow) {
        recommendations.push("🔋 Battery low. Consider charging soon.");
        healthScore -= 5;
        if (alertLevel === 'safe') alertLevel = 'warning';
      }
    }

    if (weatherData) {
      if (weatherData.temperature > 30) {
        recommendations.push("🌡️ High ambient temperature affects device cooling.");
        healthScore -= 8;
        if (alertLevel === 'safe') alertLevel = 'warning';
      } else if (weatherData.temperature < 10) {
        recommendations.push("❄️ Cold weather can temporarily reduce battery capacity.");
        healthScore -= 3;
      }
    }

    if (performanceData && performanceData.cpuLoad > 80) {
      recommendations.push("📊 High CPU load detected. Monitor for heat buildup.");
      healthScore -= 10;
      if (alertLevel === 'safe') alertLevel = 'warning';
    }

    return {
      healthScore: Math.max(0, Math.min(100, healthScore)),
      recommendations,
      alertLevel,
      lastUpdated: new Date()
    };
  }, []);

  return { generateRecommendations };
};

// Weather service utilities
const weatherUtils = {
  getWeatherDescription: (code) => {
    const descriptions = {
      0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
      45: 'Foggy', 48: 'Depositing rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle',
      55: 'Dense drizzle', 61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
      71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 95: 'Thunderstorm'
    };
    return descriptions[code] || 'Unknown';
  },
  
  getWeatherIcon: (code) => {
    if (code === 0 || code === 1) return '☀️';
    if (code === 2 || code === 3) return '⛅';
    if (code === 45 || code === 48) return '🌫️';
    if (code >= 51 && code <= 65) return '🌧️';
    if (code >= 71 && code <= 77) return '❄️';
    if (code >= 95) return '⛈️';
    return '🌤️';
  }
};

// Loading Screen Component
const LoadingScreen = ({ isVisible, progress, currentStep, steps }) => {
  if (!isVisible) return null;

  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-logo">🌡️</div>
        <h2>ThermoSense</h2>
        <div className="loading-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="loading-text">{currentStep}</div>
        </div>
        <div className="loading-steps">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`step ${step.status}`}
            >
              {step.status === 'completed' ? '✅' : step.status === 'error' ? '❌' : step.status === 'active' ? '⏳' : '⏳'} {step.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Navigation Component
const Navigation = ({ apiStatus, onThemeToggle, onExport }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-brand">
          <h2>🌡️ ThermoSense</h2>
          <span className="nav-subtitle">React Real-Time Monitoring</span>
        </div>
        <div className="nav-controls">
          <div className="api-status">
            <div className="api-indicator">
              <span className={`api-dot ${apiStatus.battery}`}></span>
              <span className="api-label">Battery</span>
            </div>
            <div className="api-indicator">
              <span className={`api-dot ${apiStatus.weather}`}></span>
              <span className="api-label">Weather</span>
            </div>
            <div className="api-indicator">
              <span className={`api-dot ${apiStatus.performance}`}></span>
              <span className="api-label">Performance</span>
            </div>
          </div>
          <div className="connection-status">
            <span className={`status-dot ${isOnline ? 'online' : 'offline'}`}></span>
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>
          <button className="btn btn--sm" onClick={onThemeToggle}>🌙</button>
          <button className="btn btn--sm" onClick={onExport}>📊 Export</button>
        </div>
      </div>
    </nav>
  );
};

// Sidebar Component
const Sidebar = ({ activeTab, onTabChange, notificationCount }) => {
  const tabs = [
    { id: 'dashboard', label: '📊 Live Dashboard' },
    { id: 'monitoring', label: '📈 Real-Time Chart' },
    // { id: 'analytics', label: '🔍 Analytics' },
    { id: 'advisory', label: '🤖 AI Advisory' },
    { id: 'notifications', label: '🔔 Alerts', badge: notificationCount },
    { id: 'settings', label: '⚙️ Settings' }
  ];

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTabChange(tab.id);
            }}
          >
            {tab.label}
            {tab.badge > 0 && (
              <span className="notification-badge visible">{tab.badge}</span>
            )}
          </button>
        ))}
      </nav>
    </aside>
  );
};

// Battery Status Component
const BatteryStatus = ({ batteryData, onRetry }) => {
  const getBatteryColor = (level) => {
    if (level < 20) return 'var(--color-error)';
    if (level < 50) return 'var(--color-warning)';
    return 'var(--color-success)';
  };

  const formatTime = (seconds) => {
    if (seconds === Infinity || !seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="widget card battery-widget">
      <div className="widget-header">
        <h3>Battery Status</h3>
        <div className="widget-status">
          <span className="widget-icon">🔋</span>
          <span className="update-indicator"></span>
        </div>
      </div>
      {batteryData ? (
        <div className="battery-display">
          <div className="battery-visual">
            <div className="battery-shell">
              <div
                className="battery-level-fill"
                style={{
                  width: `${batteryData.level}%`,
                  background: getBatteryColor(batteryData.level)
                }}
              ></div>
              <div
                className={`charging-animation ${batteryData.charging ? 'active' : ''}`}
              ></div>
            </div>
            <div className="battery-cap"></div>
          </div>
          <div className="battery-info">
            <div className="battery-percentage">
              <span>{batteryData.level}</span>
              <span className="unit">%</span>
            </div>
            <div className="battery-details">
              <span>Status: {batteryData.charging ? 'Charging' : 'Discharging'}</span>
              <span>Charging: {formatTime(batteryData.chargingTime)}</span>
              <span>Remaining: {formatTime(batteryData.dischargingTime)}</span>
              <span>Source: {batteryData.simulated ? 'Simulated' : 'Battery API'}</span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <p>Initializing battery monitoring...</p>
          <button className="btn btn--sm btn--outline" onClick={onRetry}>
            Retry Connection
          </button>
        </div>
      )}
    </div>
  );
};

// Weather Widget Component
const WeatherWidget = ({ weatherData, onRetry }) => {
  return (
    <div className="widget card weather-widget">
      <div className="widget-header">
        <h3>Live Weather</h3>
        <div className="widget-status">
          <span className="widget-icon">{weatherData ? weatherUtils.getWeatherIcon(weatherData.weatherCode) : '🌤️'}</span>
          <span className="update-indicator"></span>
        </div>
      </div>
      {weatherData ? (
        <div className="weather-info">
          <div className="weather-main">
            <span className="weather-temp">{Math.round(weatherData.temperature)}°C</span>
            <div className="weather-details">
              <div className="weather-location">
                {weatherData.fallback ? 'Default Location' : 'Current Location'}
              </div>
              <div className="weather-condition">
                {weatherUtils.getWeatherDescription(weatherData.weatherCode)}
              </div>
            </div>
          </div>
          <div className="weather-metrics">
            <div className="metric">
              <span className="metric-label">Humidity</span>
              <span className="metric-value">{weatherData.humidity}%</span>
            </div>
            <div className="metric">
              <span className="metric-label">Wind</span>
          _BOS_       <span className="metric-value">{Math.round(weatherData.windSpeed)} km/h</span>
            </div>
            <div className="metric">
              <span className="metric-label">UV Index</span>
              <span className="metric-value">{weatherData.uvIndex}</span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <p>Loading weather data...</p>
          <button className="btn btn--sm btn--outline" onClick={onRetry}>
            Retry Connection
          </button>
        </div>
      )}
    </div>
  );
};

// Device Info Component
const DeviceInfo = ({ performanceData }) => {
  return (
    <div className="widget card performance-widget">
      <div className="widget-header">
        <h3>System Performance</h3>
        <div className="widget-status">
          <span className="widget-icon">📊</span>
          <span className="update-indicator"></span>
        </div>
      </div>
      <div className="performance-info">
        <div className="perf-metric">
          <span className="perf-label">Memory Usage</span>
          <div className="perf-bar">
            <div
              className="perf-fill"
              style={{
                width: `${performanceData.memory ? (performanceData.memory.used / performanceData.memory.total) * 100 : 0}%`
              }}
            ></div>
          </div>
          <span className="perf-value">
            {performanceData.memory ? `${performanceData.memory.used} MB` : '-- MB'}
          </span>
        </div>
        <div className="perf-metric">
          <span className="perf-label">CPU Load Est.</span>
          <div className="perf-bar">
            <div className="perf-fill" style={{ width: `${performanceData.cpuLoad || 0}%` }}></div>
          </div>
          <span className="perf-value">{performanceData.cpuLoad || 0}%</span>
        </div>
        <div className="perf-metric">
          <span className="perf-label">Network</span>
          <span className="perf-value">
            {performanceData.network?.effectiveType || 'Unknown'}
          </span>
        </div>
        <div className="perf-metric">
          <span className="perf-label">CPU Cores</span>
          <span className="perf-value">{performanceData.cores || 4}</span>
        </div>
      </div>
    </div>
  );
};

// Health Analysis Component
const HealthAnalysis = ({ healthData }) => {
  const getHealthColor = (score) => {
    if (score > 80) return 'var(--color-success)';
    if (score > 60) return 'var(--color-warning)';
    return 'var(--color-error)';
  };

  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (healthData.healthScore / 100 * circumference);

  return (
    <div className="widget card health-widget">
      <div className="widget-header">
        <h3>Battery Health Impact</h3>
        <span className="widget-icon">❤️</span>
      </div>
      <div className="health-analysis">
        <div className="health-score">
          <div className="health-circle">
            <svg className="health-circle-svg" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" className="health-bg"></circle>
              <circle
                cx="50"
                cy="50"
                r="45"
                className="health-progress"
                style={{
                  stroke: getHealthColor(healthData.healthScore),
                  strokeDashoffset: offset
                }}
              ></circle>
            </svg>
            <div className="health-percentage">{healthData.healthScore}%</div>
          </div>
        </div>
        <div className="health-factors">
          <div className="factor">
            <span className="factor-label">Temperature</span>
            <span className="factor-impact">
              {healthData.alertLevel === 'danger' ? 'High' : 
               healthData.alertLevel === 'warning' ? 'Medium' : 'Low'}
            </span>
          </div>
          <div className="factor">
            <span className="factor-label">Usage Pattern</span>
            <span className="factor-impact">Normal</span>
          </div>
          <div className="factor">
            <span className="factor-label">Environment</span>
            <span className="factor-impact">Good</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Chart Display Component
const ChartDisplay = ({ isVisible }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const { batteryData, weatherData, deviceTemp, settings } = useContext(ThermoSenseContext);
  const [chartData, setChartData] = useState({
    labels: [],
    deviceTemps: [],
    ambientTemps: [],
    batteryLevels: []
  });
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isVisible && chartRef.current && !chartInstance.current) {
      const ctx = chartRef.current.getContext('2d');
      
      chartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            {
              label: 'Device Temperature',
              data: [],
              borderColor: '#1FB8CD',
              backgroundColor: 'rgba(31, 184, 205, 0.1)',
              tension: 0.4,
              fill: false,
              yAxisID: 'y'
            },
            {
              label: 'Ambient Temperature',
              data: [],
              borderColor: '#FFC185',
              backgroundColor: 'rgba(255, 193, 133, 0.1)',
              tension: 0.4,
              fill: false,
              yAxisID: 'y'
            },
            {
              label: 'Battery Level',
              data: [],
              borderColor: '#B4413C',
              backgroundColor: 'rgba(180, 65, 60, 0.1)',
              tension: 0.4,
              fill: false,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 750 },
          plugins: { legend: { display: false } },
          scales: {
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              min: 15,
              max: 55,
              title: { display: true, text: 'Temperature (°C)' }
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              min: 0,
              max: 100,
              title: { display: true, text: 'Battery Level (%)' },
              grid: { drawOnChartArea: false }
            }
          }
        }
      });
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [isVisible]);

  useEffect(() => {
    if (!chartInstance.current || isPaused) return;

    const interval = setInterval(() => {
      const timeLabel = new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });

      setChartData(prev => {
        const newData = {
          labels: [...prev.labels, timeLabel],
          deviceTemps: [...prev.deviceTemps, deviceTemp || 25],
          ambientTemps: [...prev.ambientTemps, weatherData?.temperature || 22],
          batteryLevels: [...prev.batteryLevels, batteryData?.level || 75]
        };

        if (newData.labels.length > 50) {
          newData.labels.shift();
          newData.deviceTemps.shift();
          newData.ambientTemps.shift();
          newData.batteryLevels.shift();
        }

        if (chartInstance.current) {
          chartInstance.current.data.labels = [...newData.labels];
          chartInstance.current.data.datasets[0].data = [...newData.deviceTemps];
          chartInstance.current.data.datasets[1].data = [...newData.ambientTemps];
          chartInstance.current.data.datasets[2].data = [...newData.batteryLevels];
          chartInstance.current.update('none');
        }

        return newData;
      });
    }, settings.chartInterval);

    return () => clearInterval(interval);
  }, [isPaused, deviceTemp, weatherData, batteryData, settings.chartInterval]);

  if (!isVisible) return null;

  return (
    <div>
      <div className="monitoring-header">
        <h1>Live Temperature & Performance Monitor</h1>
        <div className="chart-controls">
          <button
            className="btn btn--sm"
            onClick={() => {
              setChartData({ labels: [], deviceTemps: [], ambientTemps: [], batteryLevels: [] });
              if (chartInstance.current) {
                chartInstance.current.data.labels = [];
                chartInstance.current.data.datasets.forEach(dataset => {
                  dataset.data = [];
                });
                chartInstance.current.update();
              }
            }}
          >
            Reset Chart
          </button>
          <button
            className={`btn btn--sm ${isPaused ? '' : 'btn--primary'}`}
            onClick={() => setIsPaused(!isPaused)}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>
      <div className="chart-container" style={{ height: '400px', position: 'relative' }}>
        <canvas ref={chartRef}></canvas>
      </div>
      <div className="chart-legend">
        <div className="legend-item">
          <span className="legend-color device"></span>
          <span>Device Temperature (Estimated)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color ambient"></span>
          <span>Ambient Temperature (Weather)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color battery"></span>
          <span>Battery Level</span>
        </div>
      </div>
    </div>
  );
};

// AI Advisory Component
const AIAdvisory = ({ isVisible, healthData }) => {
  const [customAnalysis, setCustomAnalysis] = useState({
    deviceTemp: '',
    ambientTemp: '',
    batteryLevel: '',
    usage: ''
  });
  const [customResult, setCustomResult] = useState(null);

  const handleCustomAnalysis = (e) => {
    e.preventDefault();
    
    const deviceTemp = parseFloat(customAnalysis.deviceTemp);
    const ambientTemp = parseFloat(customAnalysis.ambientTemp);
    const batteryLevel = parseInt(customAnalysis.batteryLevel);
    const usage = customAnalysis.usage;

    let riskLevel = 'low';
    let recommendation = '';
    let actionItems = [];

    if (deviceTemp > 40) {
      riskLevel = 'high';
      recommendation = '🚨 CRITICAL: This temperature level poses immediate risk!';
      actionItems = [
        'Stop all intensive tasks immediately',
        'Power down device if possible',
        'Move to cool, ventilated area'
      ];
    } else if (deviceTemp > 35) {
      riskLevel = 'medium';
      recommendation = '⚠️ WARNING: Device is running hot and needs attention.';
      actionItems = [
        'Reduce intensive applications',
        'Improve ventilation',
        'Avoid charging while hot'
      ];
    } else {
      recommendation = '✅ Temperature levels are acceptable for normal use.';
      actionItems = ['Continue normal usage', 'Monitor periodically'];
    }

    if (usage === 'gaming' && deviceTemp > 30) {
      recommendation += ' Heavy usage increases thermal stress.';
      actionItems.push('Consider reducing graphics settings');
    }

    setCustomResult({
      riskLevel,
      recommendation,
      actionItems,
      impact: riskLevel === 'high' ? 'High risk of permanent damage' : 
              riskLevel === 'medium' ? 'Moderate impact on battery health' : 
              'Minimal impact on battery health'
    });
  };

  if (!isVisible) return null;

  return (
    <div>
      <div className="advisory-header">
        <h1>AI-Powered Battery Advisory</h1>
        <p className="advisory-subtitle">Get personalized recommendations based on real-time data</p>
      </div>
      
      <div className="advisory-content">
        <div className="current-analysis card">
          <h3>Current System Analysis</h3>
          <div className="analysis-result">
            <div className={`risk-level ${healthData.alertLevel}`}>
              Risk Level: {healthData.alertLevel.toUpperCase()}
            </div>
            <div className="analysis-text">
              Current health score: {healthData.healthScore}%<br />
              System Status: {healthData.alertLevel === 'danger' ? 'Immediate attention required' : 
                            healthData.alertLevel === 'warning' ? 'Monitor closely' : 'Operating normally'}
            </div>
            <div className="recommendations">
              <strong>Real-time Recommendations:</strong>
              <ul>
                {healthData.recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="custom-analysis card">
          <h3>Custom Scenario Analysis</h3>
          <form onSubmit={handleCustomAnalysis}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Device Temperature (°C)</label>
                <input
                  type="number"
                  className="form-control"
                  step="0.1"
                  min="20"
                  max="60"
                  value={customAnalysis.deviceTemp}
                  onChange={(e) => setCustomAnalysis(prev => ({ ...prev, deviceTemp: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Ambient Temperature (°C)</label>
                <input
                  type="number"
                  className="form-control"
                  step="0.1"
                  min="5"
                  max="50"
                  value={customAnalysis.ambientTemp}
                  onChange={(e) => setCustomAnalysis(prev => ({ ...prev, ambientTemp: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Battery Level (%)</label>
                <input
                  type="number"
                  className="form-control"
                  min="1"
                  max="100"
                  value={customAnalysis.batteryLevel}
                  onChange={(e) => setCustomAnalysis(prev => ({ ...prev, batteryLevel: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Usage Scenario</label>
                <select
                  className="form-control"
                  value={customAnalysis.usage}
                  onChange={(e) => setCustomAnalysis(prev => ({ ...prev, usage: e.target.value }))}
                  required
                >
                  <option value="">Select scenario...</option>
                  <option value="idle">Idle</option>
                  <option value="light">Light Usage</option>
                  <option value="moderate">Moderate Usage</option>
                  <option value="heavy">Heavy Usage</option>
                  <option value="gaming">Gaming/Intensive</option>
                  <option value="charging">Charging</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn--primary btn--full-width">
              🤖 Analyze Scenario
            </button>
          </form>
          
          {customResult && (
            <div className="custom-result">
              <div className="result-header">
                <h4>Analysis Result</h4>
                <div className={`risk-badge ${customResult.riskLevel}`}>
                  {customResult.riskLevel.toUpperCase()}
                </div>
              </div>
              <div className="result-content">
                <div className="recommendation">{customResult.recommendation}</div>
                <div className="action-items">
                  <strong>Action Items:</strong>
                  <ul>
                    {customResult.actionItems.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="impact-forecast">{customResult.impact}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Notification Center Component
const NotificationCenter = ({ isVisible, notifications, onClearAll, onTestNotification }) => {
  const [filter, setFilter] = useState('all');

  const filteredNotifications = useMemo(() => {
    if (filter === 'all') return notifications;
    return notifications.filter(n => n.type === filter);
  }, [notifications, filter]);

  if (!isVisible) return null;

  return (
    <div>
      <div className="notifications-header">
        <h1>Alert & Notification Center</h1>
        <div className="notifications-controls">
          <button className="btn btn--sm btn--outline" onClick={onClearAll}>
            Clear All
          </button>
          <button className="btn btn--sm btn--primary" onClick={onTestNotification}>
            Test Alert
          </button>
        </div>
      </div>
      
      <div className="notifications-filters">
        {['all', 'critical', 'warning', 'info'].map(filterType => (
          <button
            key={filterType}
            className={`filter-btn ${filter === filterType ? 'active' : ''}`}
            onClick={() => setFilter(filterType)}
          >
            {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
          </button>
        ))}
      </div>

      <div className="notifications-container">
        {filteredNotifications.length === 0 ? (
          <div className="no-notifications">
            {filter === 'all' ? 'No notifications yet' : `No ${filter} notifications`}
          </div>
        ) : (
          filteredNotifications.map((notif, index) => (
            <div key={index} className={`notification-full ${notif.type}`}>
              <div className="notification-timestamp">
                {notif.timestamp.toLocaleString()}
              </div>
              <div className="notification-message">
                {notif.message}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// CORRECTED Settings Component (receives state and handlers as props)
const Settings = ({ isVisible, settings, onSettingChange, onReset }) => {
  if (!isVisible) return null;

  const handleSettingChange = (key, value) => {
    onSettingChange(key, value);
  };

  return (
    <div>
      <div className="settings-header">
        <h1>Settings & Configuration</h1>
        <button className="btn btn--sm btn--outline" onClick={onReset}>Reset to Defaults</button>
      </div>
      
      <div className="settings-grid">
        <div className="settings-section card">
          <h3>Monitoring Settings</h3>
          <div className="form-group">
            <label className="form-label">Battery Update Interval</label>
            <select 
              className="form-control" 
              value={settings.batteryInterval}
              onChange={(e) => handleSettingChange('batteryInterval', parseInt(e.target.value))}
            >
              <option value="5000">5 seconds</option>
              <option value="10000">10 seconds</option>
              <option value="15000">15 seconds</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Weather Update Interval</label>
            <select 
              className="form-control"
              value={settings.weatherInterval}
              onChange={(e) => handleSettingChange('weatherInterval', parseInt(e.target.value))}
            >
              <option value="60000">1 minute</option>
              <option value="120000">2 minutes</option>
              <option value="300000">5 minutes</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Chart Update Interval</label>
            <select 
              className="form-control"
              value={settings.chartInterval}
              onChange={(e) => handleSettingChange('chartInterval', parseInt(e.target.value))}
            >
              <option value="15000">15 seconds</option>
              <option value="30000">30 seconds</option>
              <option value="60000">1 minute</option>
            </select>
          </div>
        </div>

        <div className="settings-section card">
          <h3>Alert Thresholds</h3>
          <div className="form-group">
            <label className="form-label">Temperature Warning (°C)</label>
            <input 
              type="number" 
              className="form-control" 
              value={settings.tempWarning}
              onChange={(e) => handleSettingChange('tempWarning', parseFloat(e.target.value))}
              min="30" max="45" step="0.5"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Temperature Critical (°C)</label>
            <input 
              type="number" 
              className="form-control" 
              value={settings.tempCritical}
              onChange={(e) => handleSettingChange('tempCritical', parseFloat(e.target.value))}
              min="35" max="50" step="0.5"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Battery Low (%)</label>
            <input 
              type="number" 
              className="form-control" 
              value={settings.batteryLow}
              onChange={(e) => handleSettingChange('batteryLow', parseInt(e.target.value))}
              min="5" max="30"
            />
          </div>
        </div>

        <div className="settings-section card">
          <h3>Notification Preferences</h3>
          <div className="checkbox-group">
            <label className="checkbox-label">
              <input type="checkbox" checked={settings.enableTempAlerts} onChange={(e) => handleSettingChange('enableTempAlerts', e.target.checked)} />
              Temperature alerts
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={settings.enableBatteryAlerts} onChange={(e) => handleSettingChange('enableBatteryAlerts', e.target.checked)} />
              Battery level alerts
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={settings.enableWeatherAlerts} onChange={(e) => handleSettingChange('enableWeatherAlerts', e.target.checked)} />
              Weather-based alerts
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={settings.enableSoundAlerts} onChange={(e) => handleSettingChange('enableSoundAlerts', e.target.checked)} />
              Sound notifications
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Dashboard Component
const Dashboard = () => {
  const {
    batteryData,
    weatherData,
    performanceData,
    deviceTemp,
    healthData,
    onRetryBattery,
    onRetryWeather
  } = useContext(ThermoSenseContext);

  return (
    <div>
      <div className="dashboard-header">
        <h1>Real-Time Battery Health Dashboard</h1>
        <div className="status-badges">
          <div className={`status status--${healthData.alertLevel === 'safe' ? 'success' : healthData.alertLevel === 'warning' ? 'warning' : 'error'}`}>
            {healthData.alertLevel === 'safe' ? 'System Operational' : 
             healthData.alertLevel === 'warning' ? 'Monitor Required' : 'Immediate Action Required'}
          </div>
          <div className="last-updated">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
          <div className="data-source">Source: React Hooks & APIs</div>
        </div>
      </div>

      <div className="dashboard-grid">
        <BatteryStatus batteryData={batteryData} onRetry={onRetryBattery} />
        
        <div className="widget card temperature-widget">
          <div className="widget-header">
            <h3>Temperature Status</h3>
            <div className="widget-status">
              <span className="widget-icon">🌡️</span>
              <span className="update-indicator"></span>
            </div>
          </div>
          <div className="temperature-display">
            <div className="temp-reading">
              <span className="temp-label">Estimated Device</span>
              <span className="temp-value">{deviceTemp?.toFixed(1) || '--'}</span>
              <span className="temp-unit">°C</span>
            </div>
            <div className="temp-reading">
              <span className="temp-label">Ambient Weather</span>
              <span className="temp-value">{weatherData?.temperature?.toFixed(1) || '--'}</span>
              <span className="temp-unit">°C</span>
            </div>
            <div className="temp-status">
              {deviceTemp > 40 ? 'Critical temperature' :
               deviceTemp > 35 ? 'Elevated temperature' : 'Normal range'}
            </div>
          </div>
        </div>

        <WeatherWidget weatherData={weatherData} onRetry={onRetryWeather} />
        <DeviceInfo performanceData={performanceData} />
        <HealthAnalysis healthData={healthData} />
        
        <div className="widget card alerts-widget">
          <div className="widget-header">
            <h3>Active Alerts</h3>
            <span className="widget-icon">🚨</span>
          </div>
          <div className="alerts-list">
            {healthData.alertLevel === 'danger' ? (
              <div className="alert-item critical">
                🚨 Critical temperature detected - immediate action required!
              </div>
            ) : healthData.alertLevel === 'warning' ? (
              <div className="alert-item warning">
                ⚠️ Device temperature elevated - monitor closely
              </div>
            ) : (
              <div className="no-alerts">No active alerts</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Permission Modal Component
const PermissionModal = ({ isVisible, onAllow, onDeny }) => {
  if (!isVisible) return null;

  return (
    <div className="modal">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Enable Real-Time Monitoring</h3>
        </div>
        <div className="modal-body">
          <p>ThermoSense needs access to:</p>
          <ul>
            <li>📍 Your location for weather data</li>
            <li>🔋 Battery information (if supported)</li>
            <li>📊 System performance metrics</li>
          </ul>
          <p>All data stays on your device and is used only for monitoring.</p>
        </div>
        <div className="modal-footer">
          <button 
            className="btn btn--outline" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDeny();
            }}
          >
            Use Without
          </button>
          <button 
            className="btn btn--primary" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAllow();
            }}
          >
            Enable Monitoring
          </button>
        </div>
      </div>
    </div>
  );
};

// CORRECTED Main ThermoSense App Component
const ThermoSenseApp = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [notifications, setNotifications] = useState([]);
  const [deviceTemp, setDeviceTemp] = useState(27.5);
  
  const initialSettings = {
    batteryInterval: 5000,
    weatherInterval: 120000,
    chartInterval: 30000,
    tempWarning: 35,
    tempCritical: 40,
    batteryLow: 15,
    enableTempAlerts: true,
    enableBatteryAlerts: true,
    enableWeatherAlerts: true,
    enableSoundAlerts: false
  };

  const [settings, setSettings] = useState(initialSettings);

  const { batteryData, batteryStatus, initializeBattery, retryBattery } = useBattery();
  const { weatherData, weatherStatus, getLocationAndWeather, retryWeather } = useWeather();
  const { performanceData, updatePerformance } = useDevicePerformance();
  const { generateRecommendations } = useMLModel();
  
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [loadingSteps, setLoadingSteps] = useState([
    { text: 'Starting ThermoSense...', status: 'pending' },
    { text: 'Checking browser compatibility...', status: 'pending' },
    { text: 'Requesting location access...', status: 'pending' },
    { text: 'Connecting to weather service...', status: 'pending' },
    { text: 'Initializing battery monitoring...', status: 'pending' },
    { text: 'Setting up real-time updates...', status: 'pending' }
  ]);

  const addNotification = useCallback((notification) => {
    const notificationWithId = { ...notification, id: Date.now() + Math.random(), timestamp: new Date() };
    setNotifications(prev => [notificationWithId, ...prev.slice(0, 99)]);
  }, []);

  const handleSettingChange = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleResetSettings = useCallback(() => {
    setSettings(initialSettings);
    addNotification({ type: 'info', message: '⚙️ Settings have been reset to default.' });
  }, [addNotification]);

  const apiStatus = useMemo(() => ({
    battery: batteryStatus === 'connected' ? 'connected' : 'disconnected',
    weather: weatherStatus === 'connected' ? 'connected' : 'disconnected',
    performance: 'connected'
  }), [batteryStatus, weatherStatus]);

  const healthData = useMemo(() => {
    return generateRecommendations(batteryData, weatherData, deviceTemp, performanceData, settings);
  }, [batteryData, weatherData, deviceTemp, performanceData, settings, generateRecommendations]);

  const notificationCount = useMemo(() => {
    return notifications.filter(n => n.type === 'critical' || n.type === 'warning').length;
  }, [notifications]);

  useEffect(() => {
    const runLoadingSequence = async () => {
      const steps = [
        { duration: 500, action: () => {} }, { duration: 1000, action: () => {} },
        { duration: 1500, action: () => {} }, { duration: 1000, action: () => {} },
        { duration: 1000, action: () => {} }, { duration: 500, action: () => {} }
      ];
      for (let i = 0; i < steps.length; i++) {
        setCurrentStep(loadingSteps[i].text);
        setLoadingSteps(prev => prev.map((step, index) => index === i ? { ...step, status: 'active' } : step));
        await new Promise(resolve => setTimeout(resolve, steps[i].duration));
        setLoadingSteps(prev => prev.map((step, index) => index === i ? { ...step, status: 'completed' } : step));
        setLoadingProgress((i + 1) / steps.length * 100);
      }
      setTimeout(() => {
        setIsLoading(false);
        setShowPermissionModal(true);
      }, 1000);
    };
    runLoadingSequence();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      let baseTemp = 25;
      if (weatherData) baseTemp += (weatherData.temperature - 20) * 0.3;
      if (batteryData?.charging) baseTemp += 3;
      if (performanceData.cpuLoad) baseTemp += (performanceData.cpuLoad / 100) * 8;
      baseTemp += (Math.random() - 0.5) * 2;
      setDeviceTemp(Math.max(20, Math.min(50, baseTemp)));
    }, settings.batteryInterval);
    return () => clearInterval(interval);
  }, [weatherData, batteryData, performanceData, settings.batteryInterval]);

  useEffect(() => {
    const weatherIntervalId = setInterval(() => {
        if (weatherStatus === 'connected') retryWeather();
    }, settings.weatherInterval);
    return () => clearInterval(weatherIntervalId);
  }, [retryWeather, weatherStatus, settings.weatherInterval]);

  useEffect(() => {
    const interval = setInterval(updatePerformance, 10000);
    return () => clearInterval(interval);
  }, [updatePerformance]);

  const handleAllowPermissions = async () => {
    setShowPermissionModal(false);
    try {
      await Promise.all([initializeBattery(), getLocationAndWeather()]);
      addNotification({ type: 'info', message: '✅ Monitoring permissions enabled successfully' });
    } catch (error) {
      addNotification({ type: 'warning', message: '⚠️ Some permissions could not be enabled' });
    }
  };

  const handleDenyPermissions = () => {
    setShowPermissionModal(false);
    initializeBattery();
    getLocationAndWeather();
    addNotification({ type: 'info', message: '⚠️ Running in limited mode' });
  };

  const handleThemeToggle = useCallback(() => {
    const newTheme = document.documentElement.getAttribute('data-color-scheme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-color-scheme', newTheme);
    localStorage.setItem('thermosense-theme', newTheme);
  }, []);

  const handleExport = useCallback(() => {
    const data = { timestamp: new Date().toISOString(), batteryData, weatherData, performanceData, deviceTemp, healthData, notifications, apiStatus };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `thermosense-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addNotification({ type: 'info', message: '📊 Data exported successfully' });
  }, [batteryData, weatherData, performanceData, deviceTemp, healthData, notifications, apiStatus, addNotification]);

  const handleTestNotification = useCallback(() => {
    addNotification({ type: 'info', message: '🧪 Test notification - System is working correctly!' });
  }, [addNotification]);

  const contextValue = {
    batteryData, weatherData, performanceData, deviceTemp, healthData, notifications, settings,
    onRetryBattery: retryBattery,
    onRetryWeather: retryWeather,
    addNotification
  };

  return (
    <ThermoSenseContext.Provider value={contextValue}>
      <div className="app">
        <LoadingScreen isVisible={isLoading} progress={loadingProgress} currentStep={currentStep} steps={loadingSteps} />
        <PermissionModal isVisible={showPermissionModal} onAllow={handleAllowPermissions} onDeny={handleDenyPermissions} />
        <Navigation apiStatus={apiStatus} onThemeToggle={handleThemeToggle} onExport={handleExport} />
        
        <div className="app-container">
          <Sidebar activeTab={activeTab} onTabChange={setActiveTab} notificationCount={notificationCount} />
          
          <main className="main-content">
            <div className={`tab-content ${activeTab === 'dashboard' ? 'active' : ''}`}>
              {activeTab === 'dashboard' && <Dashboard />}
            </div>
            
            <div className={`tab-content ${activeTab === 'monitoring' ? 'active' : ''}`}>
              {activeTab === 'monitoring' && <ChartDisplay isVisible={true} />}
            </div>
            
            {/* THIS DIV WAS ACCIDENTALLY DELETED - RESTORING IT FIXES THE LAYOUT */}
            <div className={`tab-content ${activeTab === 'analytics' ? 'active' : ''}`}>
              {/* The Analytics component is not used, but the wrapper div is needed */}
              {/* {activeTab === 'analytics' && <Analytics isVisible={true} />} */}
            </div>
            
            <div className={`tab-content ${activeTab === 'advisory' ? 'active' : ''}`}>
              {activeTab === 'advisory' && <AIAdvisory isVisible={true} healthData={healthData} />}
            </div>
            
            <div className={`tab-content ${activeTab === 'notifications' ? 'active' : ''}`}>
              {activeTab === 'notifications' && (
                <NotificationCenter
                  isVisible={true}
                  notifications={notifications}
                  onClearAll={() => setNotifications([])}
                  onTestNotification={handleTestNotification}
                />
              )}
            </div>
            
            <div className={`tab-content ${activeTab === 'settings' ? 'active' : ''}`}>
              {activeTab === 'settings' && (
                <Settings 
                  isVisible={true} 
                  settings={settings}
                  onSettingChange={handleSettingChange}
                  onReset={handleResetSettings}
                />
              )}
            </div>
          </main>
        </div>
      </div>
    </ThermoSenseContext.Provider>
  );
};

// Render the application
ReactDOM.render(<ThermoSenseApp />, document.getElementById('root'));

"""
Forecasting service for rating and sentiment predictions using ARIMA.
"""
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime
import asyncio
import numpy as np
import pmdarima as pm
from dateutil.relativedelta import relativedelta


@dataclass
class ForecastResult:
    forecast: List[float]
    confidence_lower: List[float]
    confidence_upper: List[float]
    periods: List[str]


class ForecastService:
    """
    Service for generating time-series forecasts using pmdarima auto_arima.
    Handles sparse data gracefully with fallback logic.
    """
    
    MIN_DATA_POINTS = 6
    DEFAULT_CONFIDENCE_LEVEL = 0.80
    
    def __init__(self):
        self._pmdarima = pm
    
    def _extract_series(self, timeline_data: List[Dict[str, Any]], value_key: str) -> tuple[List[str], np.ndarray]:
        periods = [d['period_start'] for d in timeline_data if d.get(value_key) is not None]
        values = np.array([d[value_key] for d in timeline_data if d.get(value_key) is not None])
        return periods, values
    
    def _generate_future_periods(self, last_period: str, n_periods: int, period_type: str) -> List[str]:
        last_date = datetime.fromisoformat(last_period.replace('Z', ''))
        future_periods = []
        
        delta_map = {
            'day': relativedelta(days=1),
            'week': relativedelta(weeks=1),
            'month': relativedelta(months=1),
            'year': relativedelta(years=1)
        }
        delta = delta_map.get(period_type, relativedelta(months=1))
        
        for i in range(1, n_periods + 1):
            future_date = last_date + (delta * i)
            future_periods.append(future_date.isoformat())
        
        return future_periods
    
    def _fit_arima(self, values: np.ndarray, n_periods: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        model = self._pmdarima.auto_arima(
            values,
            seasonal=False,
            suppress_warnings=True,
            error_action='ignore',
            stepwise=True,
            max_p=3,
            max_q=3,
            max_d=2
        )
        
        forecast, conf_int = model.predict(
            n_periods=n_periods,
            return_conf_int=True,
            alpha=1 - self.DEFAULT_CONFIDENCE_LEVEL
        )
        
        return forecast, conf_int[:, 0], conf_int[:, 1]
    
    def _fallback_forecast(self, values: np.ndarray, n_periods: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        mean_val = float(np.mean(values))
        std_val = float(np.std(values)) if len(values) > 1 else 0.1
        
        forecast = np.full(n_periods, mean_val)
        conf_lower = np.full(n_periods, mean_val - 1.28 * std_val)
        conf_upper = np.full(n_periods, mean_val + 1.28 * std_val)
        
        return forecast, conf_lower, conf_upper
    
    def forecast_ratings(
        self,
        timeline_data: List[Dict[str, Any]],
        periods: int = 4,
        period_type: str = 'month'
    ) -> Optional[Dict[str, Any]]:
        if not timeline_data:
            return None
        
        period_labels, values = self._extract_series(timeline_data, 'avg_rating')
        
        if len(values) < self.MIN_DATA_POINTS:
            if len(values) < 2:
                return None
            forecast, conf_lower, conf_upper = self._fallback_forecast(values, periods)
        else:
            try:
                forecast, conf_lower, conf_upper = self._fit_arima(values, periods)
            except Exception:
                forecast, conf_lower, conf_upper = self._fallback_forecast(values, periods)
        
        forecast = np.clip(forecast, 1.0, 5.0)
        conf_lower = np.clip(conf_lower, 1.0, 5.0)
        conf_upper = np.clip(conf_upper, 1.0, 5.0)
        
        future_periods = self._generate_future_periods(period_labels[-1], periods, period_type)
        
        return {
            'forecast': [
                {
                    'period': p,
                    'value': round(float(v), 2),
                    'lower': round(float(l), 2),
                    'upper': round(float(u), 2)
                }
                for p, v, l, u in zip(future_periods, forecast, conf_lower, conf_upper)
            ],
            'model_type': 'arima' if len(values) >= self.MIN_DATA_POINTS else 'fallback',
            'data_points_used': len(values)
        }
    
    def forecast_sentiment(
        self,
        timeline_data: List[Dict[str, Any]],
        periods: int = 4,
        period_type: str = 'month'
    ) -> Optional[Dict[str, Any]]:
        if not timeline_data:
            return None
        
        period_labels, values = self._extract_series(timeline_data, 'avg_sentiment_score')
        
        if len(values) < self.MIN_DATA_POINTS:
            if len(values) < 2:
                return None
            forecast, conf_lower, conf_upper = self._fallback_forecast(values, periods)
        else:
            try:
                forecast, conf_lower, conf_upper = self._fit_arima(values, periods)
            except Exception:
                forecast, conf_lower, conf_upper = self._fallback_forecast(values, periods)
        
        forecast = np.clip(forecast, -1.0, 1.0)
        conf_lower = np.clip(conf_lower, -1.0, 1.0)
        conf_upper = np.clip(conf_upper, -1.0, 1.0)
        
        future_periods = self._generate_future_periods(period_labels[-1], periods, period_type)
        
        return {
            'forecast': [
                {
                    'period': p,
                    'value': round(float(v), 3),
                    'lower': round(float(l), 3),
                    'upper': round(float(u), 3)
                }
                for p, v, l, u in zip(future_periods, forecast, conf_lower, conf_upper)
            ],
            'model_type': 'arima' if len(values) >= self.MIN_DATA_POINTS else 'fallback',
            'data_points_used': len(values)
        }
    
    async def generate_forecast(
        self,
        rating_timeline: List[Dict[str, Any]],
        sentiment_timeline: List[Dict[str, Any]],
        periods: int = 4,
        period_type: str = 'month'
    ) -> Dict[str, Any]:
        loop = asyncio.get_event_loop()
        
        rating_forecast, sentiment_forecast = await asyncio.gather(
            loop.run_in_executor(None, self.forecast_ratings, rating_timeline, periods, period_type),
            loop.run_in_executor(None, self.forecast_sentiment, sentiment_timeline, periods, period_type)
        )
        
        return {
            'rating_forecast': rating_forecast,
            'sentiment_forecast': sentiment_forecast,
            'periods_requested': periods,
            'period_type': period_type
        }

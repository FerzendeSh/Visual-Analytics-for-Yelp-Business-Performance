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
from scipy import signal
from scipy import stats


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
    
    MIN_DATA_POINTS = 4  # Reduced from 6 due to improved fallback
    MIN_FALLBACK_POINTS = 3  # Minimum points for trend-based fallback
    DEFAULT_CONFIDENCE_LEVEL = 0.80
    
    def __init__(self):
        self._pmdarima = pm
    
    def _extract_series(self, timeline_data: List[Dict[str, Any]], value_key: str) -> tuple[List[str], np.ndarray]:
        periods = [d['period_start'] for d in timeline_data if d.get(value_key) is not None]
        values = np.array([d[value_key] for d in timeline_data if d.get(value_key) is not None])
        return periods, values

    def _remove_outliers(self, values: np.ndarray) -> np.ndarray:
        """
        Remove outliers using IQR method. Fast and effective.
        Returns cleaned array with outliers replaced by median.
        """
        if len(values) < 4:
            return values

        q1 = np.percentile(values, 25)
        q3 = np.percentile(values, 75)
        iqr = q3 - q1

        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr

        # Replace outliers with median (preserves length, less aggressive than removal)
        median = np.median(values)
        cleaned = values.copy()
        outlier_mask = (values < lower_bound) | (values > upper_bound)
        cleaned[outlier_mask] = median

        return cleaned

    def _detect_seasonality(self, values: np.ndarray) -> Optional[int]:
        """
        Auto-detect seasonal period using ACF (autocorrelation).
        Dynamically adapts to data length with industry-standard thresholds.
        Returns seasonal period (e.g., 3, 4, 6, 12 for common patterns) or None.
        """
        n = len(values)

        # Need minimum data for any seasonality detection
        if n < 6:
            return None

        # Calculate statistical significance threshold (1.96/√n for 95% confidence)
        statistical_threshold = 1.96 / np.sqrt(n)

        # Industry-standard practical threshold for business forecasting
        # Balance between sensitivity (detecting real patterns) and specificity (avoiding noise)
        practical_threshold = 0.3

        # Use the larger of the two thresholds to be conservative
        # For small n: statistical_threshold is higher (e.g., 0.28 for n=50)
        # For large n: practical_threshold is higher (e.g., 0.17 for n=137)
        threshold = max(statistical_threshold, practical_threshold)

        # Dynamically determine common periods based on data length
        # Only test periods where we have sufficient data (at least 2 full cycles)
        common_periods = []

        if n >= 24:
            # Enough data for yearly seasonality (monthly data: 2+ years)
            common_periods = [12, 6, 4, 3]
        elif n >= 12:
            # Test shorter cycles only (biannual, quarterly)
            common_periods = [6, 4, 3]
        elif n >= 8:
            # Only quarterly patterns
            common_periods = [4, 3]
        else:
            # Minimal quarterly check
            common_periods = [3]

        candidate_periods = []

        for period in common_periods:
            # Require at least 2 full cycles for robust detection
            if n < period * 2:
                continue

            # Calculate autocorrelation at this lag
            try:
                acf_val = np.corrcoef(values[:-period], values[period:])[0, 1]

                # Check against dynamic threshold
                if not np.isnan(acf_val) and acf_val > threshold:
                    candidate_periods.append((period, acf_val))
            except:
                continue

        if not candidate_periods:
            return None

        # Return period with strongest correlation
        best_period, best_acf = max(candidate_periods, key=lambda x: x[1])

        # Final validation: ensure ACF exceeds threshold
        if best_acf > threshold:
            return best_period

        return None
    
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
        """
        Fit ARIMA model with improved parameters for better forecasting.
        Auto-detects seasonality and removes outliers before fitting.
        """
        # Remove outliers before fitting
        cleaned_values = self._remove_outliers(values)

        # Auto-detect seasonal period
        seasonal_period = self._detect_seasonality(cleaned_values)
        enable_seasonal = seasonal_period is not None

        model = self._pmdarima.auto_arima(
            cleaned_values,
            seasonal=enable_seasonal,
            m=seasonal_period if enable_seasonal else 1,
            suppress_warnings=True,
            error_action='ignore',
            # More thorough search for larger datasets, stepwise for small
            stepwise=False if len(cleaned_values) >= 50 else True,
            # More flexible ARIMA parameters
            max_p=5,
            max_q=5,
            max_d=2,
            # Seasonal parameters (if enabled)
            max_P=2 if enable_seasonal else 0,
            max_Q=2 if enable_seasonal else 0,
            max_D=1 if enable_seasonal else 0,
            # Information criterion for model selection
            information_criterion='aic',
            # Allow trend component
            trend='ct',  # constant + trend
        )

        forecast, conf_int = model.predict(
            n_periods=n_periods,
            return_conf_int=True,
            alpha=1 - self.DEFAULT_CONFIDENCE_LEVEL
        )

        return forecast, conf_int[:, 0], conf_int[:, 1]
    
    def _fallback_forecast(self, values: np.ndarray, n_periods: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Improved fallback forecast using linear trend + exponential smoothing.
        Better than simple mean for capturing trends in sparse data.
        """
        # Remove outliers for better trend estimation
        cleaned_values = self._remove_outliers(values)
        n = len(cleaned_values)

        # Calculate linear trend using least squares
        x = np.arange(n)
        coeffs = np.polyfit(x, cleaned_values, 1)  # Linear fit (slope, intercept)
        slope, intercept = coeffs[0], coeffs[1]

        # Generate forecast based on trend continuation
        future_x = np.arange(n, n + n_periods)
        trend_forecast = slope * future_x + intercept

        # Apply exponential smoothing to reduce noise
        alpha = 0.3  # Smoothing factor
        smoothed = cleaned_values.copy()
        for i in range(1, len(smoothed)):
            smoothed[i] = alpha * cleaned_values[i] + (1 - alpha) * smoothed[i - 1]

        # Use last smoothed value as baseline
        last_smoothed = smoothed[-1]

        # Weight between trend and last value (more weight on recent for short forecasts)
        weight_trend = min(0.7, 0.3 + (n_periods * 0.1))
        forecast = weight_trend * trend_forecast + (1 - weight_trend) * last_smoothed

        # Calculate confidence intervals based on historical volatility
        residuals = cleaned_values - (slope * x + intercept)
        std_val = float(np.std(residuals)) if n > 1 else 0.1

        # Widen confidence interval as we forecast further into future
        expanding_factor = np.sqrt(np.arange(1, n_periods + 1))
        conf_lower = forecast - 1.28 * std_val * expanding_factor
        conf_upper = forecast + 1.28 * std_val * expanding_factor

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
            if len(values) < self.MIN_FALLBACK_POINTS:
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
            if len(values) < self.MIN_FALLBACK_POINTS:
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

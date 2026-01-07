import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge Tailwind CSS classes with clsx
 * This is the standard utility used by shadcn/ui components
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse business hours and return formatted hours for today
 * @param hours - Record of day to time range (e.g., {"Monday": "7:0-20:0"})
 * @returns Object with opening/closing info or null if closed/unavailable
 */
export function getTodayHours(hours?: Record<string, string>): {
  isOpen: boolean;
  opensAt?: string;
  closesAt?: string;
  isClosedAllDay?: boolean;
  nextOpenDay?: string | null;
  nextOpenTime?: string | null;
} | null {
  if (!hours) return null;

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = dayNames[new Date().getDay()];

  // Format time as 12-hour format
  const formatTime = (hour: number, minute: number): string => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const displayMinute = minute === 0 ? '' : `:${minute.toString().padStart(2, '0')}`;
    return `${displayHour}${displayMinute} ${period}`;
  };

  const todayHours = hours[today];
  if (!todayHours) {
    // Find next open day
    const { nextDay, nextTime } = findNextOpenDay(hours, dayNames, new Date().getDay());
    return {
      isOpen: false,
      isClosedAllDay: true,
      nextOpenDay: nextDay,
      nextOpenTime: nextTime,
    };
  }

  // Parse hours format "7:0-20:0"
  const [openTime, closeTime] = todayHours.split('-');
  if (!openTime || !closeTime) {
    const { nextDay, nextTime } = findNextOpenDay(hours, dayNames, new Date().getDay());
    return {
      isOpen: false,
      isClosedAllDay: true,
      nextOpenDay: nextDay,
      nextOpenTime: nextTime,
    };
  }

  const [openHour, openMin] = openTime.split(':').map(Number);
  const [closeHour, closeMin] = closeTime.split(':').map(Number);

  // Check if closed (0:0-0:0)
  if (openHour === 0 && openMin === 0 && closeHour === 0 && closeMin === 0) {
    const { nextDay, nextTime } = findNextOpenDay(hours, dayNames, new Date().getDay());
    return {
      isOpen: false,
      isClosedAllDay: true,
      nextOpenDay: nextDay,
      nextOpenTime: nextTime,
    };
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = openHour * 60 + openMin;
  let closeMinutes = closeHour * 60 + closeMin;

  // Handle closing past midnight (e.g., 23:0-1:0)
  if (closeMinutes < openMinutes) {
    closeMinutes += 24 * 60; // Add 24 hours
  }

  const isCurrentlyOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes;

  // If closed now but opens later today
  if (!isCurrentlyOpen && currentMinutes < openMinutes) {
    return {
      isOpen: false,
      opensAt: formatTime(openHour, openMin),
      closesAt: formatTime(closeHour, closeMin),
      isClosedAllDay: false,
    };
  }

  // If closed now and won't open today, find next open day
  if (!isCurrentlyOpen) {
    const { nextDay, nextTime } = findNextOpenDay(hours, dayNames, new Date().getDay());
    return {
      isOpen: false,
      opensAt: formatTime(openHour, openMin),
      closesAt: formatTime(closeHour, closeMin),
      isClosedAllDay: false,
      nextOpenDay: nextDay,
      nextOpenTime: nextTime,
    };
  }

  return {
    isOpen: isCurrentlyOpen,
    opensAt: formatTime(openHour, openMin),
    closesAt: formatTime(closeHour, closeMin),
    isClosedAllDay: false,
  };
}

/**
 * Find the next day when business opens
 */
function findNextOpenDay(
  hours: Record<string, string>,
  dayNames: string[],
  currentDayIndex: number
): { nextDay: string; nextTime: string } | { nextDay: null; nextTime: null } {
  const formatTime = (hour: number, minute: number): string => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const displayMinute = minute === 0 ? '' : `:${minute.toString().padStart(2, '0')}`;
    return `${displayHour}${displayMinute} ${period}`;
  };

  // Check next 7 days
  for (let i = 1; i <= 7; i++) {
    const nextDayIndex = (currentDayIndex + i) % 7;
    const nextDayName = dayNames[nextDayIndex];
    const nextDayHours = hours[nextDayName];

    if (nextDayHours) {
      const [openTime] = nextDayHours.split('-');
      if (openTime) {
        const [openHour, openMin] = openTime.split(':').map(Number);
        // Check if not closed (0:0-0:0)
        if (!(openHour === 0 && openMin === 0)) {
          const formattedTime = formatTime(openHour, openMin);
          // Return "tomorrow" if it's the next day, otherwise the day name
          const dayLabel = i === 1 ? 'tomorrow' : nextDayName;
          return { nextDay: dayLabel, nextTime: formattedTime };
        }
      }
    }
  }

  return { nextDay: null, nextTime: null };
}

/**
 * Get price range display from business attributes
 * @param attributes - Business attributes object
 * @returns Price range as $ symbols (e.g., "$", "$$", "$$$", "$$$$") or null
 */
export function getPriceRange(attributes?: Record<string, any>): string | null {
  if (!attributes?.RestaurantsPriceRange2) return null;

  // Convert to number (it might be a string or number)
  const priceLevel = Number(attributes.RestaurantsPriceRange2);

  // Convert 1-4 to $ symbols
  if (priceLevel === 1) return '$';
  if (priceLevel === 2) return '$$';
  if (priceLevel === 3) return '$$$';
  if (priceLevel === 4) return '$$$$';

  return null;
}

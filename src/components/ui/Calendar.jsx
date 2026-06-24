import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ChevronDown } from "lucide-react";

// Helper to format Date object to YYYY-MM-DD
const formatDateString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// ────────────────────────────────────────────────────────
// 1. DATE CALENDAR COMPONENT (Matches Image 2)
// ────────────────────────────────────────────────────────
export function Calendar({
  selected,
  onSelect,
  className = "",
}) {
  const initialDate = selected ? new Date(selected) : new Date();
  
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth());
  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());

  useEffect(() => {
    if (selected) {
      const d = new Date(selected);
      setCurrentMonth(d.getMonth());
      setCurrentYear(d.getFullYear());
    }
  }, [selected]);

  const monthsShort = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  const years = Array.from({ length: 21 }, (_, i) => (new Date().getFullYear() - 10) + i);

  // Get total days in month
  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();

  // Get weekday of 1st day of month (0 = Sunday, 1 = Monday, etc.)
  const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleSelectDay = (day, isCurrentMonth = true, offsetMonth = 0) => {
    let targetMonth = currentMonth + offsetMonth;
    let targetYear = currentYear;
    if (targetMonth < 0) {
      targetMonth = 11;
      targetYear -= 1;
    } else if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
    const newDate = new Date(targetYear, targetMonth, day);
    onSelect(formatDateString(newDate));
  };

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDayIndex = getFirstDayOfMonth(currentMonth, currentYear); // 0 = Sunday, 1 = Monday, etc.

  // Days of previous month to pad the start
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const daysInPrevMonth = getDaysInMonth(prevMonth, prevYear);

  const cells = [];
  
  // 1. Padding from previous month (rendered in muted gray)
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayVal = daysInPrevMonth - i;
    cells.push(
      <button
        key={`prev-${dayVal}`}
        type="button"
        className="calendar-day-cell day adjacent"
        onClick={() => handleSelectDay(dayVal, false, -1)}
      >
        {dayVal}
      </button>
    );
  }

  // 2. Current month days
  const today = new Date();
  const selectedDateObj = selected ? new Date(selected) : null;

  for (let day = 1; day <= daysInMonth; day++) {
    const isToday =
      today.getDate() === day &&
      today.getMonth() === currentMonth &&
      today.getFullYear() === currentYear;

    const isSelected = selectedDateObj &&
      selectedDateObj.getDate() === day &&
      selectedDateObj.getMonth() === currentMonth &&
      selectedDateObj.getFullYear() === currentYear;

    cells.push(
      <button
        key={`current-${day}`}
        type="button"
        className={`calendar-day-cell day ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}`}
        onClick={() => handleSelectDay(day)}
      >
        {day}
      </button>
    );
  }

  // 3. Padding from next month to complete the grid (usually 42 cells total for 6 rows)
  const remainingCells = 42 - cells.length;
  for (let day = 1; day <= remainingCells; day++) {
    cells.push(
      <button
        key={`next-${day}`}
        type="button"
        className="calendar-day-cell day adjacent"
        onClick={() => handleSelectDay(day, false, 1)}
      >
        {day}
      </button>
    );
  }

  return (
    <div className={`calendar-container ${className}`}>
      <div className="calendar-header">
        <button type="button" className="calendar-nav-btn" onClick={handlePrevMonth}>
          <ChevronLeft size={16} />
        </button>

        <div className="calendar-dropdowns">
          <div className="calendar-select-wrapper">
            <select
              value={currentMonth}
              onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
              className="calendar-select"
            >
              {monthsShort.map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>
            <ChevronDown size={10} className="select-arrow" />
          </div>

          <div className="calendar-select-wrapper">
            <select
              value={currentYear}
              onChange={(e) => setCurrentYear(parseInt(e.target.value))}
              className="calendar-select"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <ChevronDown size={10} className="select-arrow" />
          </div>
        </div>

        <button type="button" className="calendar-nav-btn" onClick={handleNextMonth}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="calendar-weekdays">
        <span>Su</span>
        <span>Mo</span>
        <span>Tu</span>
        <span>We</span>
        <span>Th</span>
        <span>Fr</span>
        <span>Sa</span>
      </div>

      <div className="calendar-grid">
        {cells}
      </div>
    </div>
  );
}


// ────────────────────────────────────────────────────────
// 2. MONTH & YEAR PICKER COMPONENT (Matches Image 1)
// ────────────────────────────────────────────────────────
export function MonthPicker({
  value, // YYYY-MM
  onChange,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse initial YYYY-MM
  const parseValue = (val) => {
    if (!val) return { year: new Date().getFullYear(), month: new Date().getMonth() };
    const [y, m] = val.split("-").map(Number);
    return { year: y, month: m - 1 };
  };

  const { year: valYear, month: valMonth } = parseValue(value);
  const [selectedYear, setSelectedYear] = useState(valYear);

  useEffect(() => {
    const { year: y } = parseValue(value);
    setSelectedYear(y);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const monthsShort = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  const monthsFull = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handleSelectMonth = (monthIdx) => {
    const formattedMonth = String(monthIdx + 1).padStart(2, "0");
    onChange(`${selectedYear}-${formattedMonth}`);
    setIsOpen(false);
  };

  const handleClear = () => {
    const today = new Date();
    const formattedMonth = String(today.getMonth() + 1).padStart(2, "0");
    onChange(`${today.getFullYear()}-${formattedMonth}`);
    setIsOpen(false);
  };

  const handleThisMonth = () => {
    const today = new Date();
    const formattedMonth = String(today.getMonth() + 1).padStart(2, "0");
    onChange(`${today.getFullYear()}-${formattedMonth}`);
    setIsOpen(false);
  };

  const displayLabel = `${monthsFull[valMonth]} ${valYear}`;

  return (
    <div className="month-picker-container" ref={containerRef}>
      {/* Trigger Button */}
      <button 
        type="button" 
        className="month-picker-trigger" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{displayLabel}</span>
        <CalendarIcon size={14} className="month-picker-icon" />
      </button>

      {/* Dropdown Panel (Image 1 style) */}
      {isOpen && (
        <div className="month-picker-dropdown">
          {/* Year selector header */}
          <div className="month-picker-header">
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="month-picker-year-select"
            >
              {Array.from({ length: 15 }, (_, i) => (new Date().getFullYear() - 7) + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* 3x4 Month grid */}
          <div className="month-picker-grid">
            {monthsShort.map((m, idx) => {
              const isSelected = valYear === selectedYear && valMonth === idx;
              return (
                <button
                  key={m}
                  type="button"
                  className={`month-picker-cell ${isSelected ? "selected" : ""}`}
                  onClick={() => handleSelectMonth(idx)}
                >
                  {m}
                </button>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="month-picker-footer">
            <button type="button" className="footer-action-btn" onClick={handleClear}>
              Clear
            </button>
            <button type="button" className="footer-action-btn primary-action" onClick={handleThisMonth}>
              This month
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

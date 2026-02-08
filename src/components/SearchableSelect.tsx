'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  options?: string[];
  className?: string;
  allowCustom?: boolean; // 是否允许输入自定义值
}

export default function SearchableSelect({
  value,
  onChange,
  placeholder = '请选择或输入',
  options = [],
  className = '',
  allowCustom = true,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 过滤选项
  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 检查是否有完全匹配的选项
  const hasExactMatch = filteredOptions.some(
    option => option.toLowerCase() === searchTerm.toLowerCase()
  );

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 更新搜索词
  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  // 处理输入变化
  const handleInputChange = (newValue: string) => {
    setSearchTerm(newValue);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  // 处理选择选项
  const handleSelectOption = (option: string) => {
    setSearchTerm(option);
    onChange(option);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  // 处理键盘导航
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    const optionsCount = filteredOptions.length + (allowCustom && !hasExactMatch ? 1 : 0);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => {
          if (prev < optionsCount - 1) {
            return prev + 1;
          }
          return prev;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => {
          if (prev > 0) {
            return prev - 1;
          }
          return -1;
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          if (allowCustom && !hasExactMatch && highlightedIndex === 0) {
            // 选择自定义输入
            onChange(searchTerm);
            setIsOpen(false);
          } else {
            // 选择选项
            const optionIndex = allowCustom && !hasExactMatch ? highlightedIndex - 1 : highlightedIndex;
            if (optionIndex >= 0 && optionIndex < filteredOptions.length) {
              handleSelectOption(filteredOptions[optionIndex]);
            }
          }
        } else if (hasExactMatch) {
          // 如果有精确匹配，选择第一个匹配的选项
          handleSelectOption(filteredOptions[0]);
        } else if (allowCustom && searchTerm) {
          // 如果没有精确匹配，选择自定义输入
          onChange(searchTerm);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  // 处理失去焦点
  const handleBlur = () => {
    // 延迟关闭，以便处理点击事件
    setTimeout(() => {
      setIsOpen(false);
      onChange(searchTerm);
    }, 200);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* 输入框 */}
      <input
        ref={inputRef}
        type="text"
        value={searchTerm}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-white/10 rounded-lg border border-white/20 text-white focus:outline-none focus:border-purple-500"
      />

      {/* 下拉选项列表 */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-gray-900 border border-white/20 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {/* 自定义输入选项 */}
          {allowCustom && searchTerm && !hasExactMatch && (
            <div
              className={`px-3 py-2 cursor-pointer hover:bg-purple-500/20 text-gray-300 text-sm ${
                highlightedIndex === 0 ? 'bg-purple-500/30' : ''
              }`}
              onClick={() => {
                onChange(searchTerm);
                setIsOpen(false);
              }}
            >
              <span className="text-yellow-400">+</span> 添加新词: {searchTerm}
            </div>
          )}

          {/* 过滤后的选项 */}
          {filteredOptions.map((option, index) => {
            const displayIndex = allowCustom && !hasExactMatch ? index + 1 : index;
            return (
              <div
                key={option}
                className={`px-3 py-2 cursor-pointer hover:bg-purple-500/20 text-gray-300 text-sm ${
                  displayIndex === highlightedIndex ? 'bg-purple-500/30' : ''
                }`}
                onClick={() => handleSelectOption(option)}
              >
                {option}
              </div>
            );
          })}

          {/* 无结果提示 */}
          {filteredOptions.length === 0 && (!allowCustom || !searchTerm) && (
            <div className="px-3 py-2 text-gray-500 text-sm">
              无匹配选项
            </div>
          )}
        </div>
      )}
    </div>
  );
}

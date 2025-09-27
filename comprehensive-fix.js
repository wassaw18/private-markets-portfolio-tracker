#!/usr/bin/env node
// Comprehensive automated fix for React Hook dependencies and unused variables

const fs = require('fs');
const path = require('path');

const fixes = [
  {
    file: 'src/components/CashFlowCalendar.tsx',
    fixes: [
      {
        type: 'import',
        from: "import React, { useState, useEffect } from 'react';",
        to: "import React, { useState, useEffect, useCallback } from 'react';"
      },
      {
        type: 'function',
        from: "const fetchMonthlyData = async () => {",
        to: "const fetchMonthlyData = useCallback(async () => {"
      },
      {
        type: 'removeVar',
        pattern: /const direction = .+?;/g
      },
      {
        type: 'removeVar',
        pattern: /const daysInMonth = .+?;/g
      }
    ]
  },
  {
    file: 'src/components/EditInvestmentModal.tsx',
    fixes: [
      {
        type: 'removeImport',
        pattern: /import { validateInvestment } from .+?;/g
      },
      {
        type: 'removeVar',
        pattern: /const \[fieldErrors, setFieldErrors\] = useState.+?;/g
      }
    ]
  },
  {
    file: 'src/pages/BenchmarkManagement.tsx',
    fixes: [
      {
        type: 'removeImport',
        pattern: /, BenchmarkReturn/g
      },
      {
        type: 'removeVar',
        pattern: /const getInvestmentOptions = .+?;/gs
      },
      {
        type: 'removeVar',
        pattern: /const calculateCommonInceptionDate = .+?;/gs
      },
      {
        type: 'removeVar',
        pattern: /const formatPercentage = .+?;/gs
      }
    ]
  }
];

console.log('🔧 Applying comprehensive fixes...');

fixes.forEach(({file, fixes: fileFixes}) => {
  const filePath = path.join(__dirname, 'frontend', file);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${file}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  fileFixes.forEach(fix => {
    switch(fix.type) {
      case 'import':
        content = content.replace(fix.from, fix.to);
        break;
      case 'function':
        content = content.replace(fix.from, fix.to);
        break;
      case 'removeVar':
      case 'removeImport':
        content = content.replace(fix.pattern, '');
        break;
    }
  });

  fs.writeFileSync(filePath, content);
  console.log(`✅ Fixed ${file}`);
});

console.log('🎉 Comprehensive fixes applied!');
#!/bin/bash
# Automated ESLint issue fixer for Private Markets Tracker

echo "🔧 Fixing ESLint issues systematically..."

# Fix AssetAllocationChart.tsx - remove unused imports
echo "Fixing AssetAllocationChart.tsx..."
sed -i 's/import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from '\''recharts'\'';/import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from '\''recharts'\'';/g' src/components/AssetAllocationChart.tsx

# Fix DocumentUploadModal.tsx - remove unused imports
echo "Fixing DocumentUploadModal.tsx..."
sed -i '/entityAPI\|investmentAPI/d' src/components/DocumentUploadModal.tsx

# Fix DocumentsList.tsx - remove unused import
echo "Fixing DocumentsList.tsx..."
sed -i 's/import React, { useState, useEffect, useMemo }/import React, { useState, useEffect }/g' src/components/DocumentsList.tsx

# Fix Holdings.tsx - remove unused imports
echo "Fixing Holdings.tsx..."
sed -i 's/import React, { useState, useEffect, useMemo }/import React, { useState, useEffect }/g' src/pages/Holdings.tsx
sed -i '/FilterPanel\|ComponentErrorBoundary/d' src/pages/Holdings.tsx

# Fix validation.ts - fix regex escape
echo "Fixing validation.ts..."
sed -i 's/\\\\+/\\+/g' src/utils/validation.ts

echo "✅ Basic fixes completed. Now checking build..."
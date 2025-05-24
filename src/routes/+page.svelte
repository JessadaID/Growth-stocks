<script>
  import { onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';

  const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY ;
  const TECH_STOCKS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "NFLX",
    "ORCL", "CRM", "ADBE", "INTC", "AMD", "QCOM", "AVGO", "TXN",
    "UBER", "SHOP", "SQ", "PYPL", "SNOW", "PLTR", "CRWD", "ZM",
    "DOCU", "TWLO", "OKTA", "NET", "DDOG", "MDB"
  ];

  let stocks = new Map();
  let isLoading = false;
  let autoRefresh = false;
  let refreshInterval;
  let loadedCount = 0;
  let sortBy = 'symbol';
  let sortOrder = 'asc';

  $: stocksArray = Array.from(stocks.values()).sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    
    // Handle null values
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;
    
    // Handle string vs number comparison
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    
    const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortOrder === 'asc' ? comparison : -comparison;
  });
  
  $: progress = TECH_STOCKS.length > 0 ? (loadedCount / TECH_STOCKS.length) * 100 : 0;

  function sortTable(column) {
    if (sortBy === column) {
      sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = column;
      sortOrder = 'asc';
    }
  }

  function getSortIcon(column) {
    if (sortBy !== column) return '↕️';
    return sortOrder === 'asc' ? '↑' : '↓';
  }

  async function fetchStock(symbol) {
    try {
      
      const response = await fetch(
        `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_API_KEY}`,
 
      );
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      if (!data.metric) {
        console.warn(`No metric data for ${symbol}`);
        return;
      }

      const stock = {
        symbol,
        pe: data.metric.peNormalizedAnnual ?? null,
        eps: data.metric.epsTTM ?? null,
        currentRatio: data.metric.currentRatioAnnual ?? null,
        revenueGrowth: data.metric.revenueGrowth3Y ?? null,
        pb: data.metric.pbAnnual ?? null,
        profitMargin: data.metric.netProfitMarginAnnual ?? null,
        lastUpdated: new Date(),
        score: 0
      };

      // Calculate score
      stock.score = calculateScore(stock);

      stocks.set(symbol, stock);
      stocks = stocks;
      loadedCount++;
      
      
    } catch (error) {
      console.error(`❌ Error fetching ${symbol}:`, error);
    }
  }

  function calculateScore(stock) {
  const { pe, eps, currentRatio, revenueGrowth, pb, profitMargin } = stock;
  let score = 0;

  // Revenue Growth (เน้นที่สุด)
  if (revenueGrowth !== null) {
    if (revenueGrowth > 0.3) score += 3; // เติบโตเร็วมาก
    else if (revenueGrowth > 0.15) score += 2;
    else if (revenueGrowth > 0.05) score += 1;
    else if (revenueGrowth < 0) score -= 2;
  }

  // EPS (เติบโตของกำไร)
  if (eps !== null) {
    if (eps > 10) score += 2;
    else if (eps > 5) score += 1;
    else if (eps < 0) score -= 2;
  }

  // Profit Margin (คงไว้บางส่วน)
  if (profitMargin !== null) {
    if (profitMargin > 0.2) score += 1;
    else if (profitMargin < 0) score -= 1;
  }

  // P/E Ratio (ลดความสำคัญลง)
  if (pe !== null) {
    if (pe < 15) score += 0.5;
    else if (pe > 40) score -= 1;
  }

  // Current Ratio (ปลอดภัยแต่ไม่ใช่ประเด็นหลัก)
  if (currentRatio !== null && currentRatio < 1) {
    score -= 0.5;
  }

  // P/B Ratio (ลดความสำคัญลง)
  if (pb !== null && pb > 10) {
    score -= 0.5;
  }

  return score;
}


  async function fetchAllStocks() {
    if (isLoading) return;
    
    isLoading = true;
    loadedCount = 0;
    
    
    const promises = TECH_STOCKS.map((symbol, index) => 
      new Promise(resolve => {
        setTimeout(() => {
          fetchStock(symbol).then(resolve);
        }, index * 200);
      })
    );
    
    await Promise.all(promises);
    
    isLoading = false;
  }

  function toggleAutoRefresh() {
    autoRefresh = !autoRefresh;
    
    if (autoRefresh) {
      refreshInterval = setInterval(() => {
        if (!isLoading) {
          fetchAllStocks();
        }
      }, 30000);
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
    }
  }

  function getAnalysisDisplay(stock) {
    const score = stock.score;
    
    if (score >= 6) {
      return { emoji: '🌟', text: 'ยอดเยี่ยม', class: 'bg-green-100 text-green-800' };
    } else if (score >= 4) {
      return { emoji: '✅', text: 'ดีมาก', class: 'bg-green-50 text-green-700' };
    } else if (score >= 2) {
      return { emoji: '👍', text: 'ดี', class: 'bg-blue-50 text-blue-700' };
    } else if (score >= 0) {
      return { emoji: '⚠️', text: 'ปานกลาง', class: 'bg-yellow-50 text-yellow-700' };
    } else if (score >= -2) {
      return { emoji: '❌', text: 'ไม่แนะนำ', class: 'bg-red-50 text-red-700' };
    } else {
      return { emoji: '🚫', text: 'หลีกเลี่ยง', class: 'bg-red-100 text-red-800' };
    }
  }

  function formatValue(value, isPercentage = false) {
    if (value === null || value === undefined) return '-';
    if (isPercentage) {
      return `${(value * 100).toFixed(2)}%`;
    }
    return value.toFixed(2);
  }

  onMount(() => {
    fetchAllStocks();
  });

  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });
</script>

<svelte:head>
  <title>หุ้นเทคที่น่าซื้อมีแนวโน้มเติบโตเยอะ</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <!-- Header -->
    <div class="text-center mb-8">
      <h1 class="text-4xl font-bold text-gray-900 mb-4">
        📈 หุ้นเทคที่น่าซื้อมีแนวโน้มเติบโตเยอะ
      </h1>
      <p class="text-lg text-gray-600">
        วิเคราะห์หุ้นเทคโนโลยีชั้นนำตามตัวชี้วัดทางการเงิน
      </p>
    </div>

    <!-- Controls -->
    <div class="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div class="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
          <div class="flex items-center space-x-2">
            {#if isLoading}
              <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span class="text-sm text-gray-600">กำลังโหลด...</span>
            {:else}
              <div class="h-5 w-5 bg-green-500 rounded-full"></div>
              <span class="text-sm text-gray-600">พร้อมใช้งาน</span>
            {/if}
          </div>
          
          <div class="text-sm text-gray-500">
            โหลดแล้ว: {loadedCount}/{TECH_STOCKS.length}
          </div>
          
          {#if isLoading}
            <div class="w-32 bg-gray-200 rounded-full h-2">
              <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: {progress}%"></div>
            </div>
          {/if}
        </div>

        <div class="flex items-center space-x-4">
          <label class="flex items-center space-x-2 cursor-pointer">
            <input 
              type="checkbox" 
              bind:checked={autoRefresh} 
              on:change={toggleAutoRefresh}
              class="rounded text-blue-600 focus:ring-blue-500"
            />
            <span class="text-sm text-gray-700">🔄 Auto Refresh (30s)</span>
          </label>
          
          <button 
            on:click={fetchAllStocks} 
            disabled={isLoading}
            class="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors font-medium"
          >
            {isLoading ? '⏳ กำลังโหลด...' : '🔄 Refresh ข้อมูล'}
          </button>
        </div>
      </div>
    </div>

    <!-- Stock Table -->
    {#if stocksArray.length > 0}
      <div class="bg-white rounded-lg shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    on:click={() => sortTable('symbol')}>
                  <div class="flex items-center space-x-1">
                    <span>Symbol</span>
                    <span class="text-gray-400">{getSortIcon('symbol')}</span>
                  </div>
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    on:click={() => sortTable('pe')}>
                  <div class="flex items-center space-x-1">
                    <span>P/E Ratio</span>
                    <span class="text-gray-400">{getSortIcon('pe')}</span>
                  </div>
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    on:click={() => sortTable('eps')}>
                  <div class="flex items-center space-x-1">
                    <span>EPS (TTM)</span>
                    <span class="text-gray-400">{getSortIcon('eps')}</span>
                  </div>
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    on:click={() => sortTable('currentRatio')}>
                  <div class="flex items-center space-x-1">
                    <span>Current Ratio</span>
                    <span class="text-gray-400">{getSortIcon('currentRatio')}</span>
                  </div>
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    on:click={() => sortTable('revenueGrowth')}>
                  <div class="flex items-center space-x-1">
                    <span>Growth 3Y</span>
                    <span class="text-gray-400">{getSortIcon('revenueGrowth')}</span>
                  </div>
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    on:click={() => sortTable('pb')}>
                  <div class="flex items-center space-x-1">
                    <span>P/B Ratio</span>
                    <span class="text-gray-400">{getSortIcon('pb')}</span>
                  </div>
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    on:click={() => sortTable('profitMargin')}>
                  <div class="flex items-center space-x-1">
                    <span>Profit Margin</span>
                    <span class="text-gray-400">{getSortIcon('profitMargin')}</span>
                  </div>
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    on:click={() => sortTable('score')}>
                  <div class="flex items-center space-x-1">
                    <span>คะแนน</span>
                    <span class="text-gray-400">{getSortIcon('score')}</span>
                  </div>
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  อัปเดตล่าสุด
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {#each stocksArray as stock (stock.symbol)}
                {@const analysis = getAnalysisDisplay(stock)}
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-bold text-gray-900">{stock.symbol}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatValue(stock.pe)}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatValue(stock.eps)}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatValue(stock.currentRatio)}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatValue(stock.revenueGrowth, true)}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatValue(stock.pb)}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatValue(stock.profitMargin, true)}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {analysis.class}">
                      {analysis.emoji} {analysis.text} ({stock.score})
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {stock.lastUpdated.toLocaleTimeString('th-TH', { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {:else if !isLoading}
      <div class="bg-white rounded-lg shadow-sm p-8 text-center">
        <p class="text-gray-500">ยังไม่มีข้อมูล กรุณากดปุ่ม Refresh</p>
      </div>
    {/if}

    {#if isLoading}
      <div class="bg-white rounded-lg shadow-sm p-6 mt-6 text-center">
        <div class="flex items-center justify-center space-x-2">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <p class="text-gray-600">⏳ กำลังโหลดข้อมูล... ({loadedCount}/{TECH_STOCKS.length})</p>
        </div>
      </div>
    {/if}

            <!-- Scoring Guide -->
        <div class="grid md:grid-cols-2 gap-6 mt-8">
        <div class="bg-white rounded-lg shadow-sm p-6">
            <h2 class="text-xl font-bold text-gray-900 mb-4">📊 เกณฑ์การประเมิน</h2>
            <div class="space-y-4 text-sm">
            
            <div>
                <h3 class="font-semibold text-gray-800">P/E Ratio (อัตราส่วนราคาต่อกำไร)</h3>
                <div class="text-gray-600 ml-2 mb-1">
                บ่งบอกว่าหุ้นแพงหรือถูกเมื่อเทียบกับกำไร หากต่ำแปลว่าราคายังไม่แพงมาก
                </div>
                <div class="text-gray-600 ml-2">
                <div>&lt; 15: ดีมาก (+2 คะแนน)</div>
                <div>15-20: ดี (+1 คะแนน)</div>
                <div>&gt; 30: สูงมาก (-1 คะแนน)</div>
                </div>
            </div>

            <div>
                <h3 class="font-semibold text-gray-800">EPS (Earnings Per Share)</h3>
                <div class="text-gray-600 ml-2 mb-1">
                กำไรสุทธิต่อหุ้น แสดงถึงความสามารถในการทำกำไร ยิ่งสูงยิ่งดี
                </div>
                <div class="text-gray-600 ml-2">
                <div>&gt; 5: สูง (+2 คะแนน)</div>
                <div>&gt; 0: บวก (+1 คะแนน)</div>
                <div>≤ 0: ติดลบ (-2 คะแนน)</div>
                </div>
            </div>

            <div>
                <h3 class="font-semibold text-gray-800">Current Ratio (อัตราส่วนสภาพคล่อง)</h3>
                <div class="text-gray-600 ml-2 mb-1">
                วัดความสามารถในการชำระหนี้ระยะสั้น ยิ่งสูงเกินพอดี อาจบ่งบอกถึงการใช้เงินไม่คุ้มค่า
                </div>
                <div class="text-gray-600 ml-2">
                <div>1.5-3: สภาพคล่องดี (+1 คะแนน)</div>
                <div>&lt; 1: สภาพคล่องต่ำ (-1 คะแนน)</div>
                <div>&gt; 4: เงินสดมากเกิน (-0.5 คะแนน)</div>
                </div>
            </div>

            </div>
        </div>


      <div class="bg-white rounded-lg shadow-sm p-6">
        <h2 class="text-xl font-bold text-gray-900 mb-4">🎯 ผลการประเมิน</h2>
        <div class="space-y-3 text-sm">
          <div class="flex items-center space-x-2">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              🌟 ยอดเยี่ยม
            </span>
            <span class="text-gray-600">(≥6): หุ้นที่มีพื้นฐานแข็งแกร่งมาก</span>
          </div>
          
          <div class="flex items-center space-x-2">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
              ✅ ดีมาก
            </span>
            <span class="text-gray-600">(4-5): หุ้นที่น่าสนใจลงทุน</span>
          </div>
          
          <div class="flex items-center space-x-2">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
              👍 ดี
            </span>
            <span class="text-gray-600">(2-3): หุ้นที่มีจุดเด่น</span>
          </div>
          
          <div class="flex items-center space-x-2">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">
              ⚠️ ปานกลาง
            </span>
            <span class="text-gray-600">(0-1): ต้องพิจารณาอย่างระมัดระวัง</span>
          </div>
          
          <div class="flex items-center space-x-2">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
              ❌ ไม่แนะนำ
            </span>
            <span class="text-gray-600">(-1 ถึง -2): มีความเสี่ยงสูง</span>
          </div>
          
          <div class="flex items-center space-x-2">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              🚫 หลีกเลี่ยง
            </span>
            <span class="text-gray-600">(&lt;-2): ไม่แนะนำให้ลงทุน</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="text-center mt-8 text-sm text-gray-500">
      <p>ข้อมูลจาก Finnhub API | อัปเดตแบบเรียลไทม์</p>
      <p class="mt-1">⚠️ ข้อมูลนี้ใช้สำหรับการศึกษาเท่านั้น ไม่ใช่คำแนะนำในการลงทุน</p>
    </div>
  </div>
</div>
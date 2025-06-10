// Garden Game JavaScript
(function() {
  // Use config from external file
  var CONFIG = window.GardenConfig;

  var moneyEl = document.getElementById('money');
  var seedsEl = document.getElementById('seeds');
  var potCountEl = document.getElementById('pot-count');
  var seedBuyerCountEl = document.getElementById('seed-buyer-count');
  var seedsPerSecLineEl = document.getElementById('seeds-per-sec-line');
  var moneyRateEl = document.getElementById('money-rate');
  var seedRateEl = document.getElementById('seed-rate');
  var moneyRateLineEl = document.getElementById('money-rate-line');
  var seedRateLineEl = document.getElementById('seed-rate-line');
  var buySeedBtn = document.getElementById('buy-seed');
  var buyPotBtn = document.getElementById('buy-pot');
  var buyAutoHarvesterBtn = document.getElementById('buy-auto-harvester');
  var buyAutoPlanterBtn = document.getElementById('buy-auto-planter');
  var buyAutoSeederBtn = document.getElementById('buy-auto-seeder');
  var buy10SeedsBtn = document.getElementById('buy-10-seeds');
  var testPalette = document.getElementById('test-palette');
  var potsContainer = document.getElementById('pots-container');

  // Game state
  var seeds = 1;
  var money = 0;
  var pots = [
    {
      id: 0,
      planted: false,
      growth: 0,
      plantTime: null
    }
  ];

  var STATS_WINDOW = 10000; // milliseconds
  var statsHistory = [];

  // Check for test mode (for palette visibility only)
  var urlParams = new URLSearchParams(window.location.search);
  var isTestMode = urlParams.has('test');

  // Save/Load functions for persistence
  function saveGame() {
    var gameState = {
      seeds: seeds,
      money: money,
      pots: pots,
      hasAutoHarvester: hasAutoHarvester,
      hasAutoPlanter: hasAutoPlanter,
      seedBuyerCount: seedBuyerCount,
      individualSeedsPurchased: individualSeedsPurchased,
      forceMinimal: forceMinimal,
      lastSaved: Date.now()
    };
    localStorage.setItem('gardenGameState', JSON.stringify(gameState));
  }

  function loadGame() {
    try {
      var saved = localStorage.getItem('gardenGameState');
      if (saved) {
        var gameState = JSON.parse(saved);

        // Restore basic state
        seeds = gameState.seeds !== undefined ? gameState.seeds : 1;
        money = gameState.money || 0;
        hasAutoHarvester = gameState.hasAutoHarvester || false;
        hasAutoPlanter = gameState.hasAutoPlanter || false;
        seedBuyerCount = gameState.seedBuyerCount || 0;
        individualSeedsPurchased = gameState.individualSeedsPurchased || 0;
        forceMinimal = gameState.forceMinimal || false;

        // Restore pots with proper structure and simulate time progression
        if (gameState.pots && gameState.pots.length > 0) {
          var currentTime = Date.now();
          var timeSinceLastSave = gameState.lastSaved ? currentTime - gameState.lastSaved : 0;

          pots = gameState.pots.map(function(pot, index) {
            var newPot = {
              id: index,
              planted: pot.planted || false,
              growth: pot.growth || 0,
              plantTime: pot.plantTime
            };

            // If plant was growing when saved, continue its growth
            if (newPot.planted && newPot.plantTime && newPot.growth < 100) {
              var totalGrowthTime = currentTime - newPot.plantTime;
              newPot.growth = (totalGrowthTime / CONFIG.GROWTH_DURATION) * 100;
              if (newPot.growth > 100) newPot.growth = 100;
            }

            return newPot;
          });
        }

        // Reset seed buyer timer state
        lastSeedBuyerUpdate = Date.now();
        seedBuyerRemainder = 0.0;

        // Reset auto-planter timer state
        lastAutoPlanterUpdate = -1;
        autoPlanterRemainder = 0.0;

        return true; // Successfully loaded
      }
    } catch (e) {
      console.error('Failed to load game state:', e);
    }
    return false; // No save found or error
  }

  function resetGameState() {
    seeds = 1;
    money = 0;
    pots = [{
      id: 0,
      planted: false,
      growth: 0,
      plantTime: null
    }];
    hasAutoHarvester = false;
    hasAutoPlanter = false;
    seedBuyerCount = 0;
    individualSeedsPurchased = 0;
    forceMinimal = false;
    testFreeMode = false;
    testFastGrowth = false;
    seedBuyerRemainder = 0.0;
    lastSeedBuyerUpdate = Date.now();
    currentSeedBuyerRate = 0;
    autoPlanterRemainder = 0.0;
    lastAutoPlanterUpdate = -1;
    // Force UI updates for money and pot count
    uiState.money = -1;
    uiState.potCount = -1;
    renderPots();
    updatePotCompactness();
    update();
    updateControls();
    saveGame();
  }

  var hasAutoHarvester = false;
  var hasAutoPlanter = false;
  var seedBuyerCount = 0;
  var seedBuyerRemainder = 0.0; // Fractional remainder for seed buying
  var lastSeedBuyerUpdate = Date.now();
  var currentSeedBuyerRate = 0; // Current effective rate after slowdown
  var forceMinimal = false; // Manual toggle override
  var testFreeMode = false; // Test mode for free purchases
  var testFastGrowth = false; // Test mode for fast growth
  var individualSeedsPurchased = 0; // Track individual seed purchases

  // UI state tracking
  var uiState = {
    money: -1, // Initialize to -1 to force first update
    seeds: -1,
    potCount: -1,
    seedBuyerCount: -1,
    currentSeedBuyerRate: -1,
    moneyRate: -1,
    seedRate: -1,
    seedBtnText: '',
    potBtnText: '',
    autoHarvesterBtnText: '',
    autoPlanterBtnText: '',
    autoSeederBtnText: '',
    buy10SeedsBtnText: '',
    seedBtnDisabled: null,
    potBtnDisabled: null,
    autoHarvesterBtnDisabled: null,
    autoPlanterBtnDisabled: null,
    autoSeederBtnDisabled: null,
    buy10SeedsBtnDisabled: null,
    pots: {} // Track pot UI states
  };

  function getNextSeedBuyerCost() {
    return Math.ceil(CONFIG.AUTO_SEEDER_BASE_COST * Math.pow(CONFIG.SEED_BUYER_SCALING, seedBuyerCount));
  }

  function getCurrentPotCost() {
    var scalingFactor = Math.floor(pots.length / CONFIG.POT_SCALING_THRESHOLD);
    return Math.floor(CONFIG.POT_COST * Math.pow(CONFIG.POT_SCALING_FACTOR, scalingFactor));
  }

  function hasGrowingPlants() {
    return pots.some(function(pot) {
      return pot.planted; // Either growing or ready to harvest
    });
  }

  function updatePotCompactness() {
    var shouldBeCompact = hasAutoPlanter && hasAutoHarvester;
    var shouldBeMinimal = (shouldBeCompact && pots.length > 18) || forceMinimal;

    // Update container classes
    if (shouldBeMinimal) {
      potsContainer.classList.add('compact-mode', 'minimal-mode');
    } else if (shouldBeCompact) {
      potsContainer.classList.add('compact-mode');
      potsContainer.classList.remove('minimal-mode');
    } else {
      potsContainer.classList.remove('compact-mode', 'minimal-mode');
    }

    // Update individual automation classes
    if (hasAutoPlanter) {
      potsContainer.classList.add('auto-planter');
    } else {
      potsContainer.classList.remove('auto-planter');
    }

    if (hasAutoHarvester) {
      potsContainer.classList.add('auto-harvester');
    } else {
      potsContainer.classList.remove('auto-harvester');
    }
  }

  function updatePotButtons() {
    // Button visibility is now handled by CSS via compact-mode class
    updatePotCompactness();
  }

  function createPotElement(pot) {
    var potDiv = document.createElement('div');
    potDiv.className = 'pot';

    var plantButton = hasAutoPlanter ? '' : `<button class="plant-btn" data-pot="${pot.id}">Plant seed</button>`;
    var harvestButton = hasAutoHarvester ? '' : `<button class="harvest-btn" data-pot="${pot.id}" disabled>Harvest ($${formatMoney(CONFIG.SALE_PRICE)})</button>`;

    potDiv.innerHTML = `
      <h3>Pot ${pot.id + 1} <span class="plant-visual" data-pot="${pot.id}"></span></h3>
      <progress class="growth-bar" max="100" value="0"></progress>
      <div class="pot-actions">
        ${plantButton}
        ${harvestButton}
      </div>
    `;
    return potDiv;
  }

  function renderPots() {
    potsContainer.innerHTML = '';
    // Reset pot UI state since we're re-rendering with new DOM elements
    uiState.pots = {};

    pots.forEach(function(pot) {
      potsContainer.appendChild(createPotElement(pot));
    });

    // Add event listeners to new buttons
    document.querySelectorAll('.plant-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var potId = parseInt(this.dataset.pot);
        plantSeed(potId);
      });
    });

    document.querySelectorAll('.harvest-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var potId = parseInt(this.dataset.pot);
        harvestFlower(potId);
      });
    });

    // Note: updatePotCompactness() will be called by update() after renderPots()
  }

  function addNewPot(pot) {
    var newPotElement = createPotElement(pot);
    potsContainer.appendChild(newPotElement);

    // Add event listeners to new buttons
    var plantBtn = newPotElement.querySelector('.plant-btn');
    if (plantBtn) {
      plantBtn.addEventListener('click', function() {
        var potId = parseInt(this.dataset.pot);
        plantSeed(potId);
      });
    }

    var harvestBtn = newPotElement.querySelector('.harvest-btn');
    if (harvestBtn) {
      harvestBtn.addEventListener('click', function() {
        var potId = parseInt(this.dataset.pot);
        harvestFlower(potId);
      });
    }

    // No transition needed - container classes handle styling
  }

  function plantSeed(potId) {
    var pot = pots[potId];
    if (seeds > 0 && !pot.planted) {
      seeds--;
      pot.growth = 0;
      pot.planted = true;
      pot.plantTime = Date.now();
      update();
    }
  }

  function harvestFlower(potId) {
    var pot = pots[potId];
    if (pot.growth >= 100 && pot.planted) {
      // Add harvesting class for bouncy animation
      var potElement = document.querySelector(`[data-pot="${potId}"]`).closest('.pot');
      potElement.classList.add('harvesting');

      pot.planted = false;
      pot.growth = 0;
      money += CONFIG.SALE_PRICE;
      update();
      updateControls();

      // Remove harvesting class after animation completes
      setTimeout(function() {
        potElement.classList.remove('harvesting');
      }, 500);
    }
  }

  function autoPlantSeeds(numSeeds) {
    var seedsPlanted = 0;
    for (var i = 0; i < pots.length && seedsPlanted < numSeeds && seeds > 0; i++) {
      var pot = pots[i];
      // Check if pot is currently being harvested
      var potElement = document.querySelector(`[data-pot="${pot.id}"]`);
      var isHarvesting = potElement && potElement.closest('.pot').classList.contains('harvesting');

      // Auto-plant if empty, we have seeds, and pot isn't mid-harvest animation
      if (!pot.planted && !isHarvesting) {
        seeds--;
        pot.growth = 0;
        pot.planted = true;
        pot.plantTime = Date.now();
        seedsPlanted++;
      }
    }
    return seedsPlanted;
  }

  // Format numbers with commas
  function formatMoney(amount) {
    return amount.toLocaleString();
  }

  // Update functions that only modify DOM when values change
  function updateMoney(value) {
    if (uiState.money !== value) {
      uiState.money = value;
      moneyEl.textContent = value < 0 ? '-$' + formatMoney(Math.abs(value)) : '$' + formatMoney(value);
    }
  }

  function updateSeeds(value) {
    if (uiState.seeds !== value) {
      uiState.seeds = value;
      seedsEl.textContent = value;
    }
  }

  function updatePotCount(value) {
    if (uiState.potCount !== value) {
      uiState.potCount = value;
      potCountEl.textContent = value;
    }
  }

  function updateSeedBuyerCount(value, currentRate) {
    var rateChanged = uiState.currentSeedBuyerRate !== currentRate;
    if (uiState.seedBuyerCount !== value || rateChanged) {
      uiState.seedBuyerCount = value;
      uiState.currentSeedBuyerRate = currentRate;

      if (value > 0) {
        // Show both base count and current effective rate
        var rateText = currentRate !== undefined ? currentRate.toFixed(1) : value;
        seedBuyerCountEl.textContent = rateText;
        seedsPerSecLineEl.classList.remove('hidden');
      } else {
        seedsPerSecLineEl.classList.add('hidden');
      }
    }
  }

  function updateMoneyRate(value) {
    if (uiState.moneyRate !== value) {
      uiState.moneyRate = value;
      moneyRateEl.textContent = value.toFixed(1);
      if (value === 0) {
        moneyRateLineEl.classList.add('hidden');
      } else {
        moneyRateLineEl.classList.remove('hidden');
      }
    }
  }

  function updateSeedRate(value) {
    if (uiState.seedRate !== value) {
      uiState.seedRate = value;
      seedRateEl.textContent = value.toFixed(1);
      if (value === 0) {
        seedRateLineEl.classList.add('hidden');
      } else {
        seedRateLineEl.classList.remove('hidden');
      }
    }
  }

  function updateButtonState(button, text, disabled, stateKey) {
    var textKey = stateKey + 'Text';
    var disabledKey = stateKey + 'Disabled';

    if (uiState[textKey] !== text) {
      uiState[textKey] = text;
      button.innerHTML = text;
    }

    if (uiState[disabledKey] !== disabled) {
      uiState[disabledKey] = disabled;
      button.disabled = disabled;
    }
  }

  function update() {
    updateMoney(money);
    updateSeeds(seeds);
    updatePotCount(pots.length);
    updateSeedBuyerCount(seedBuyerCount, currentSeedBuyerRate); // Show effective rate

    // Update each pot's display
    pots.forEach(function(pot) {
      var plantBtn = document.querySelector(`[data-pot="${pot.id}"].plant-btn`);
      var harvestBtn = document.querySelector(`[data-pot="${pot.id}"].harvest-btn`);
      var plantVisual = document.querySelector(`.plant-visual[data-pot="${pot.id}"]`);
      var growthBar = plantVisual ? plantVisual.closest('.pot').querySelector('.growth-bar') : null;

      if (growthBar && plantVisual) {
        // Initialize pot state if needed
        if (!uiState.pots[pot.id]) {
          uiState.pots[pot.id] = {
            plantBtnDisabled: null,
            harvestBtnDisabled: null,
            growth: -1,
            visual: ''
          };
        }

        var potState = uiState.pots[pot.id];

        // Update plant button state (if button exists)
        if (plantBtn) {
          var plantBtnShouldBeDisabled = pot.planted || seeds <= 0;
          if (potState.plantBtnDisabled !== plantBtnShouldBeDisabled) {
            potState.plantBtnDisabled = plantBtnShouldBeDisabled;
            plantBtn.disabled = plantBtnShouldBeDisabled;
          }
        }

        // Update harvest button state (if button exists)
        if (harvestBtn) {
          var harvestBtnShouldBeDisabled = pot.growth < 100;
          if (potState.harvestBtnDisabled !== harvestBtnShouldBeDisabled) {
            potState.harvestBtnDisabled = harvestBtnShouldBeDisabled;
            harvestBtn.disabled = harvestBtnShouldBeDisabled;
          }
        }

        // Update growth bar
        if (potState.growth !== pot.growth) {
          potState.growth = pot.growth;
          growthBar.value = pot.growth;
        }

        // Update visual state
        var newVisual;
        if (!pot.planted) {
          newVisual = ''; // Empty pot
        } else if (pot.growth >= 90) {
          newVisual = '🌹'; // Nearly ready to harvest
        } else if (pot.growth >= 33.33) {
          newVisual = '🌿'; // Growing nicely
        } else {
          newVisual = '🌱'; // Just planted
        }

        if (potState.visual !== newVisual) {
          potState.visual = newVisual;
          plantVisual.textContent = newVisual;
        }
      }
    });
  }

  function updateControls() {
    updateButtonState(
      buySeedBtn,
      '<span>Buy seed ($' + formatMoney(CONFIG.SEED_COST) + ')</span>',
      !testFreeMode && money < CONFIG.SEED_COST && !(money === 0 && seeds === 0 && !hasGrowingPlants()),
      'seedBtn'
    );

    // Show "buy 10 seeds" button after buying threshold individual seeds
    if (individualSeedsPurchased >= CONFIG.BULK_SEED_UNLOCK) {
      buy10SeedsBtn.classList.remove('hidden');
      var buy10Cost = CONFIG.SEED_COST * 10;
      updateButtonState(
        buy10SeedsBtn,
        '<span>Buy 10 seeds ($' + formatMoney(buy10Cost) + ')</span>',
        !testFreeMode && money < buy10Cost,
        'buy10SeedsBtn'
      );
    } else {
      buy10SeedsBtn.classList.add('hidden');
    }

    updateButtonState(
      buyPotBtn,
      '<span>Buy pot ($' + formatMoney(getCurrentPotCost()) + ')</span>',
      !testFreeMode && money < getCurrentPotCost(),
      'potBtn'
    );

    updateButtonState(
      buyAutoHarvesterBtn,
      hasAutoHarvester ? '<span>Auto-Harvester (Owned)</span>' : '<span>Auto-Harvester ($' + formatMoney(CONFIG.AUTO_HARVESTER_COST) + ')</span>',
      hasAutoHarvester || (!testFreeMode && money < CONFIG.AUTO_HARVESTER_COST),
      'autoHarvesterBtn'
    );

    updateButtonState(
      buyAutoPlanterBtn,
      hasAutoPlanter ? '<span>Auto-Planter (Owned)</span>' : '<span>Auto-Planter ($' + formatMoney(CONFIG.AUTO_PLANTER_COST) + ')</span>',
      hasAutoPlanter || (!testFreeMode && money < CONFIG.AUTO_PLANTER_COST),
      'autoPlanterBtn'
    );

    // Show seed buyer only after auto-planter is purchased
    if (hasAutoPlanter) {
      buyAutoSeederBtn.classList.remove('hidden');
      var nextCost = getNextSeedBuyerCost();
      var buttonText = seedBuyerCount > 0
        ? '<span>Seed Buyer #' + (seedBuyerCount + 1) + ' ($' + formatMoney(nextCost) + ')</span>'
        : '<span>Seed Buyer ($' + formatMoney(nextCost) + ')</span>';
      updateButtonState(
        buyAutoSeederBtn,
        buttonText,
        !testFreeMode && money < nextCost,
        'autoSeederBtn'
      );
    } else {
      buyAutoSeederBtn.classList.add('hidden');
    }
  }

  // Auto-grow progress over time
  setInterval(function() {
    pots.forEach(function(pot) {
      if (pot.planted && pot.growth < 100) {
        var effectiveGrowthDuration = testFastGrowth ? CONFIG.GROWTH_DURATION / 10 : CONFIG.GROWTH_DURATION;
        pot.growth = (Date.now() - pot.plantTime) / effectiveGrowthDuration * 100;
        if (pot.growth > 100) pot.growth = 100;
      }

      // Auto-harvest when ready
      if (hasAutoHarvester && pot.growth >= 100 && pot.planted) {
        // Give a brief moment to see the final flower emoji before harvesting
        setTimeout(function() {
          harvestFlower(pot.id);
        }, 200);
      }

    });
    update();
  }, 16);

  // Track recent money and seed changes
  setInterval(function() {
    var now = Date.now();
    statsHistory.push({ time: now, money: money, seeds: seeds });
    while (statsHistory.length > 0 && now - statsHistory[0].time > STATS_WINDOW) {
      statsHistory.shift();
    }
    if (statsHistory.length > 1) {
      var oldest = statsHistory[0];
      var dt = (now - oldest.time) / 1000;
      var moneyRate = (money - oldest.money) / dt;
      var seedRate = (seeds - oldest.seeds) / dt;
      updateMoneyRate(moneyRate);
      updateSeedRate(seedRate);
    } else {
      updateMoneyRate(0);
      updateSeedRate(0);
    }
  }, 1000);

  // Update button states less frequently to avoid interfering with clicks
  setInterval(function() {
    updateControls();
  }, 100);

  // Auto-planter runs at 20fps, calculating seeds to plant based on speed
  var autoPlanterRemainder = 0.0;
  var lastAutoPlanterUpdate = -1;

  setInterval(function() {
    if (hasAutoPlanter) {
      const autoPlanterSpeed = pots.length / (CONFIG.GROWTH_DURATION / 1000); // Plant seeds at rate to keep all pots busy

      var now = Date.now();

      // Only do timing calculations if timer is active
      if (lastAutoPlanterUpdate !== -1) {
        var deltaTime = (now - lastAutoPlanterUpdate) / 1000; // Convert to seconds

        // Calculate fractional seeds to plant and accumulate remainder
        autoPlanterRemainder += autoPlanterSpeed * deltaTime;

        // Plant whole seeds from the accumulated remainder
        var seedsToPlant = Math.floor(autoPlanterRemainder);
        if (seedsToPlant > 0) {
          var seedsPlanted = autoPlantSeeds(seedsToPlant);
          autoPlanterRemainder -= seedsPlanted; // Subtract only seeds actually planted
          if (seedsPlanted > 0) {
            update();
          }
        }
      }

      // Update timer state based on seed availability
      if (seeds === 0) {
        lastAutoPlanterUpdate = -1;
        autoPlanterRemainder = 0.0;
      } else {
        lastAutoPlanterUpdate = now; // Update timer (start if was -1, continue if active)
      }
    }
  }, 50);

  // Auto-seeders run smoothly, accumulating fractional progress
  setInterval(function() {
    if (seedBuyerCount > 0) {
      var now = Date.now();
      var deltaTime = (now - lastSeedBuyerUpdate) / 1000; // Convert to seconds
      lastSeedBuyerUpdate = now;

      // Calculate slowdown multiplier based on seed stockpile
      // 1% slower for each seed starting from 0
      var slowdownMultiplier = 1 / (1 + seeds * 0.01);

      // Update current effective rate
      currentSeedBuyerRate = seedBuyerCount * slowdownMultiplier;

      // Add fractional seeds to remainder (seedBuyerCount seeds per second, adjusted by slowdown)
      seedBuyerRemainder += seedBuyerCount * deltaTime * slowdownMultiplier;

      // Buy whole seeds from the accumulated remainder
      var wholeSeedsToBuy = Math.floor(seedBuyerRemainder);
      if (wholeSeedsToBuy > 0) {
        var totalCost = wholeSeedsToBuy * CONFIG.SEED_COST;
        if (money >= totalCost) {
          // Can afford all whole seeds
          money -= totalCost;
          seeds += wholeSeedsToBuy;
          seedBuyerRemainder -= wholeSeedsToBuy; // Keep the fractional part
          update();
        } else if (money >= CONFIG.SEED_COST) {
          // Can afford some seeds
          var affordableSeeds = Math.floor(money / CONFIG.SEED_COST);
          money -= affordableSeeds * CONFIG.SEED_COST;
          seeds += affordableSeeds;
          seedBuyerRemainder -= affordableSeeds; // Keep the fractional part
          update();
        }
      }
    }
  }, 16);

  function attachDirectListeners() {
    buySeedBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!this.disabled && (testFreeMode || money >= CONFIG.SEED_COST || (money === 0 && seeds === 0 && !hasGrowingPlants()))) {
        if (!testFreeMode) money -= CONFIG.SEED_COST;
        seeds++;
        individualSeedsPurchased++; // Track individual seed purchases
        update();
      }
    });

    buy10SeedsBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      var buy10Cost = CONFIG.SEED_COST * 10;
      if (!this.disabled && (testFreeMode || money >= buy10Cost)) {
        if (!testFreeMode) money -= buy10Cost;
        seeds += 10;
        update();
      }
    });

    buyPotBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      var currentPotCost = getCurrentPotCost();
      if (!this.disabled && (testFreeMode || money >= currentPotCost)) {
        if (!testFreeMode) money -= currentPotCost;
        var newPot = {
          id: pots.length,
          planted: false,
          growth: 0,
          plantTime: null
        };
        pots.push(newPot);
        addNewPot(newPot);
        updatePotCompactness();
        update();
      }
    });

    buyAutoHarvesterBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!this.disabled && (testFreeMode || money >= CONFIG.AUTO_HARVESTER_COST) && !hasAutoHarvester) {
        if (!testFreeMode) money -= CONFIG.AUTO_HARVESTER_COST;
        hasAutoHarvester = true;
        updatePotButtons(); // Update button visibility and animate compactness
        update();
      }
    });

    buyAutoPlanterBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!this.disabled && (testFreeMode || money >= CONFIG.AUTO_PLANTER_COST) && !hasAutoPlanter) {
        if (!testFreeMode) money -= CONFIG.AUTO_PLANTER_COST;
        hasAutoPlanter = true;
        // Reset auto-planter timer state when first purchased to prevent backfill
        lastAutoPlanterUpdate = -1;
        autoPlanterRemainder = 0.0;
        updatePotButtons(); // Update button visibility and animate compactness
        update();
      }
    });

    buyAutoSeederBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      var nextCost = getNextSeedBuyerCost();
      if (!this.disabled && (testFreeMode || money >= nextCost)) {
        if (!testFreeMode) money -= nextCost;
        seedBuyerCount++;
        // Reset timer and remainder when first seed buyer is purchased to prevent backfill
        if (seedBuyerCount === 1) {
          lastSeedBuyerUpdate = Date.now();
          seedBuyerRemainder = 0.0;
        }
        update();
      }
    });

    // Test palette event listeners
    document.getElementById('test-free-mode').addEventListener('click', function(e) {
      e.stopPropagation();
      testFreeMode = !testFreeMode;
      this.textContent = testFreeMode ? 'Disable Free Mode' : 'Toggle Free Mode';
      updateControls();
    });

    document.getElementById('test-add-money').addEventListener('click', function(e) {
      e.stopPropagation();
      money += 10000;
      update();
    });

    document.getElementById('test-add-seeds').addEventListener('click', function(e) {
      e.stopPropagation();
      seeds += 100;
      update();
    });

    document.getElementById('test-speed-growth').addEventListener('click', function(e) {
      e.stopPropagation();
      testFastGrowth = !testFastGrowth;
      this.textContent = testFastGrowth ? 'Disable Fast Growth' : 'Toggle Fast Growth';
    });

    document.getElementById('test-toggle-minimal').addEventListener('click', function(e) {
      e.stopPropagation();
      forceMinimal = !forceMinimal;
      updatePotCompactness();
      this.textContent = forceMinimal ? 'Disable Minimal' : 'Toggle Minimal';
    });

    document.getElementById('test-add-pots').addEventListener('click', function(e) {
      e.stopPropagation();
      for (var i = 0; i < 10; i++) {
        var newPot = {
          id: pots.length,
          planted: false,
          growth: 0,
          plantTime: null
        };
        pots.push(newPot);
        addNewPot(newPot);
      }
      updatePotCompactness();
      update();
    });

    document.getElementById('test-unlock-all').addEventListener('click', function(e) {
      e.stopPropagation();
      hasAutoPlanter = true;
      hasAutoHarvester = true;
      seedBuyerCount = 5;
      updatePotButtons();
      update();
    });

    document.getElementById('test-reset-game').addEventListener('click', function(e) {
      e.stopPropagation();
      if (confirm('Reset all game progress?')) {
        resetGameState();
      }
    });

    // Test palette collapse/expand functionality
    document.getElementById('test-palette-toggle').addEventListener('click', function(e) {
      e.stopPropagation();
      testPalette.classList.toggle('collapsed');
    });
  }

  // Show test palette only in test mode
  if (isTestMode) {
    testPalette.classList.remove('hidden');
    // Start collapsed on mobile screens
    if (window.innerWidth <= 768) {
      testPalette.classList.add('collapsed');
    }
  }

  // Attach direct listeners after a delay
  setTimeout(attachDirectListeners, 100);

  // Call updateControls initially to handle the buy 10 seeds button visibility
  setTimeout(function() {
    updateControls();
  }, 150);

  // Load saved game state
  loadGame();
  statsHistory.push({ time: Date.now(), money: money, seeds: seeds });

  // Initial render
  renderPots();
  updatePotCompactness(); // Set correct compact state without animation
  update();
  updateControls();

  // Auto-save every 5 seconds
  setInterval(saveGame, 5000);

  // Save on page unload
  window.addEventListener('beforeunload', saveGame);
})();

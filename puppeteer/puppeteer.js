const puppeteer = require('puppeteer');


(async () => {
  // Launch a new browser instance in non-headless mode
  const browser = await puppeteer.launch({ headless: false });

  // Function to wait until the peer-id is not empty
  async function waitForNonEmptyPeerId(page) {
    let peerId = '';
    while (!peerId) {
      // Fetch the peer-id value
      peerId = await page.$eval('#peer-id', el => el.textContent.trim());
      if (!peerId) {
        console.log('Waiting for peer-id to be non-empty...');
        await new Promise(r => setTimeout(r, 100)); // Wait for 500ms before checking again
      }
    }
    return peerId;
  }
  

  // Open the initial page
  let currentPage = await browser.newPage();
  await currentPage.goto('https://iduck.dk/media/'); // Replace with your actual URL
  await currentPage.setViewport({width: 1080, height: 1024});

  await new Promise(r => setTimeout(r, 250));

  // Wait for the element with id="peer-id" to exist and its value to be non-empty
  await currentPage.waitForSelector('#peer-id');
  let peerId = await waitForNonEmptyPeerId(currentPage);

  const maxIterations = 9; // Set the number of times you want to repeat the process
  for (let i = 0; i < maxIterations; i++) {
    // Open a new tab to the same page
    const newPage = await browser.newPage();
    await newPage.goto('https://iduck.dk/media/'); // Replace with your actual URL

    await newPage.setViewport({width: 1080, height: 1024});

    await new Promise(r => setTimeout(r, 1000));

    // Wait for the input field and insert the copied peerId
    await newPage.waitForSelector('#peer-id-input');
    await newPage.$eval('#peer-id-input', (el, value) => el.value = value, peerId);

    // Activate the connectToPeer() function
    await newPage.evaluate(() => {
      connectToPeer();
    });

    // Wait for the new peerId to exist and be non-empty
    await newPage.waitForSelector('#peer-id');
    peerId = await waitForNonEmptyPeerId(newPage);

    // Update the currentPage reference
    currentPage = newPage;

    await new Promise(r => setTimeout(r, 250));
  }

  // Do not close the browser and current page
  console.log('Script completed.');
  // await browser.close(); // Removed to keep the browser open
})();
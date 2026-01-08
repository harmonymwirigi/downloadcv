const express = require('express');
const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'CV Automation Service Running' });
});

// Helper function for waiting
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Main automation endpoint - ONLY DOWNLOAD
app.post('/download-cv', async (req, res) => {
  const { candidate_id, cv_link } = req.body;

  // Validation
  if (!candidate_id || !cv_link) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      required: ['candidate_id', 'cv_link']
    });
  }

  let browser;
  const downloadPath = '/tmp';
  
  try {
    console.log(`\n========================================`);
    console.log(`Processing CV for candidate: ${candidate_id}`);
    console.log(`CV Link: ${cv_link}`);
    console.log(`========================================\n`);
    
    // Launch browser - SICHTBAR für Debugging
    console.log('🚀 Launching browser...');
    browser = await puppeteer.launch({
      headless: false,
      devtools: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    
    // Setup download handling BEFORE navigating
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadPath
    });
    
    // Intercept network requests to catch redirects
    let finalPdfUrl = null;
    let allRequests = [];
    await page.setRequestInterception(true);
    
    page.on('request', (request) => {
      const url = request.url();
      allRequests.push(url);
      
      if (url.endsWith('.pdf') || (url.includes('amazonaws.com') && url.includes('.pdf'))) {
        finalPdfUrl = url;
        console.log('✅ Found PDF URL:', url);
      }
      request.continue();
    });

    // Navigate to CV link
    console.log('🌐 Navigating to page...');
    const response = await page.goto(cv_link, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    console.log(`📄 Page status: ${response.status()}`);
    
    // Wait for JavaScript to execute
    console.log('⏳ Waiting 5 seconds for page to load completely...');
    await wait(5000);
    
    // Log all network requests
    console.log(`\n📊 Total network requests: ${allRequests.length}`);
    console.log('🔍 Looking for PDF URLs...');
    allRequests.forEach(url => {
      if (url.includes('.pdf') || url.includes('amazonaws')) {
        console.log('  -', url);
      }
    });
    
    // Check if we found a direct PDF URL from network interception
    let fileBuffer;
    let fileName = `cv_${candidate_id}.pdf`;
    
    if (finalPdfUrl) {
      console.log('\n✅ Downloading PDF from intercepted URL...');
      console.log(`URL: ${finalPdfUrl.substring(0, 100)}...`);
      
      const pdfResponse = await axios.get(finalPdfUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });
      fileBuffer = Buffer.from(pdfResponse.data);
      console.log(`📥 Downloaded ${fileBuffer.length} bytes`);
    } else {
      // Try to find download link in the page
      console.log('\n🔎 No PDF URL intercepted, searching in page content...');
      
      const downloadUrl = await page.evaluate(() => {
        // Look for meta refresh
        const metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
        if (metaRefresh) {
          const content = metaRefresh.getAttribute('content');
          const urlMatch = content.match(/url=(.+)/i);
          if (urlMatch) return urlMatch[1];
        }
        
        // Look for any links with .pdf
        const links = Array.from(document.querySelectorAll('a'));
        for (const link of links) {
          if (link.href.includes('.pdf')) {
            return link.href;
          }
        }
        
        // Check if current URL is a PDF
        if (window.location.href.includes('.pdf')) {
          return window.location.href;
        }
        
        return null;
      });
      
      if (downloadUrl) {
        console.log('✅ Found download URL in page:', downloadUrl);
        const pdfResponse = await axios.get(downloadUrl, {
          responseType: 'arraybuffer',
          timeout: 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          }
        });
        fileBuffer = Buffer.from(pdfResponse.data);
        console.log(`📥 Downloaded ${fileBuffer.length} bytes`);
      } else {
        console.log('❌ No download URL found in page');
        console.log('⏳ Waiting for automatic download...');
        await wait(5000);
        
        const files = fs.readdirSync(downloadPath).filter(f => 
          f.endsWith('.pdf') && 
          !f.startsWith('.') &&
          fs.statSync(path.join(downloadPath, f)).mtime > new Date(Date.now() - 60000)
        );
        
        if (files.length > 0) {
          console.log('✅ Found downloaded file:', files[0]);
          const filePath = path.join(downloadPath, files[0]);
          fileBuffer = fs.readFileSync(filePath);
          fileName = files[0];
          fs.unlinkSync(filePath);
        } else {
          throw new Error('Could not find or download PDF file. Check the browser window to see what happened.');
        }
      }
    }
    
    // Validate it's a PDF
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('Downloaded file is empty');
    }
    
    const isPDF = fileBuffer.toString('utf8', 0, 4) === '%PDF';
    if (!isPDF) {
      console.log('❌ File header:', fileBuffer.toString('utf8', 0, 100));
      throw new Error('Downloaded file is not a valid PDF');
    }

    console.log(`\n✅✅✅ PDF SUCCESSFULLY DOWNLOADED! ✅✅✅`);
    console.log(`File: ${fileName}`);
    console.log(`Size: ${fileBuffer.length} bytes`);

    // Return the file as base64 (so it can be used later)
    const base64Data = fileBuffer.toString('base64');

    res.json({
      success: true,
      candidate_id: candidate_id,
      file_name: fileName,
      file_size: fileBuffer.length,
      file_base64: base64Data,
      message: 'CV successfully downloaded'
    });

  } catch (error) {
    console.error('\n❌❌❌ ERROR ❌❌❌');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    
    res.status(500).json({
      error: error.message,
      candidate_id: candidate_id
    });
  } finally {
    console.log('\n⏳ Waiting 5 seconds before closing browser...');
    await wait(5000);
    
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed\n');
    }
  }
});

// FULL automation endpoint - Download + Airtable Upload
app.post('/process-cv', async (req, res) => {
  const { candidate_id, cv_link, airtable_base_id, airtable_table_name, airtable_token } = req.body;

  // Validation
  if (!candidate_id || !cv_link || !airtable_base_id || !airtable_table_name || !airtable_token) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      required: ['candidate_id', 'cv_link', 'airtable_base_id', 'airtable_table_name', 'airtable_token']
    });
  }

  let browser;
  const downloadPath = '/tmp';
  
  try {
    console.log(`\n========================================`);
    console.log(`Processing CV for candidate: ${candidate_id}`);
    console.log(`CV Link: ${cv_link}`);
    console.log(`========================================\n`);
    
    // Launch browser
    console.log('🚀 Launching browser...');
    const isProduction = process.env.NODE_ENV === 'production';
    browser = await puppeteer.launch({
      headless: isProduction ? 'new' : false,
      devtools: !isProduction,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        ...(isProduction ? ['--disable-extensions'] : [])
      ]
    });

    const page = await browser.newPage();
    
    // Setup download handling
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadPath
    });
    
    // Intercept network requests
    let finalPdfUrl = null;
    let allRequests = [];
    await page.setRequestInterception(true);
    
    page.on('request', (request) => {
      const url = request.url();
      allRequests.push(url);
      
      if (url.endsWith('.pdf') || (url.includes('amazonaws.com') && url.includes('.pdf'))) {
        finalPdfUrl = url;
        console.log('✅ Found PDF URL:', url);
      }
      request.continue();
    });

    // Navigate to CV link
    console.log('🌐 Navigating to page...');
    const response = await page.goto(cv_link, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    console.log(`📄 Page status: ${response.status()}`);
    console.log('⏳ Waiting 5 seconds for page to load...');
    await wait(5000);
    
    console.log(`\n📊 Total network requests: ${allRequests.length}`);
    console.log('🔍 Looking for PDF URLs...');
    allRequests.forEach(url => {
      if (url.includes('.pdf') || url.includes('amazonaws')) {
        console.log('  -', url);
      }
    });

    // Download the PDF with multiple fallback mechanisms
    let fileBuffer;
    let fileName = `cv_${candidate_id}.pdf`;
    let pdfDownloadUrl = null; // Store the actual PDF URL for Airtable

    if (finalPdfUrl) {
      console.log('\n✅ Downloading PDF from intercepted URL...');
      console.log(`URL: ${finalPdfUrl.substring(0, 100)}...`);

      pdfDownloadUrl = finalPdfUrl;
      const pdfResponse = await axios.get(finalPdfUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });
      fileBuffer = Buffer.from(pdfResponse.data);
      console.log(`📥 Downloaded ${fileBuffer.length} bytes`);
    } else {
      // Fallback: Try to find download link in the page
      console.log('\n🔎 No PDF URL intercepted, searching in page content...');

      const downloadUrl = await page.evaluate(() => {
        // Look for meta refresh
        const metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
        if (metaRefresh) {
          const content = metaRefresh.getAttribute('content');
          const urlMatch = content.match(/url=(.+)/i);
          if (urlMatch) return urlMatch[1];
        }

        // Look for any links with .pdf
        const links = Array.from(document.querySelectorAll('a'));
        for (const link of links) {
          if (link.href.includes('.pdf')) {
            return link.href;
          }
        }

        // Check if current URL is a PDF
        if (window.location.href.includes('.pdf')) {
          return window.location.href;
        }

        return null;
      });

      if (downloadUrl) {
        console.log('✅ Found download URL in page:', downloadUrl);
        pdfDownloadUrl = downloadUrl;
        const pdfResponse = await axios.get(downloadUrl, {
          responseType: 'arraybuffer',
          timeout: 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          }
        });
        fileBuffer = Buffer.from(pdfResponse.data);
        console.log(`📥 Downloaded ${fileBuffer.length} bytes`);
      } else {
        console.log('❌ No download URL found in page');
        console.log('⏳ Waiting for automatic download...');
        await wait(5000);

        const files = fs.readdirSync(downloadPath).filter(f =>
          f.endsWith('.pdf') &&
          !f.startsWith('.') &&
          fs.statSync(path.join(downloadPath, f)).mtime > new Date(Date.now() - 60000)
        );

        if (files.length > 0) {
          console.log('✅ Found downloaded file:', files[0]);
          const filePath = path.join(downloadPath, files[0]);
          fileBuffer = fs.readFileSync(filePath);
          fileName = files[0];
          fs.unlinkSync(filePath);
        } else {
          throw new Error('Could not find or download PDF file. Check the browser window to see what happened.');
        }
      }
    }

    // Validate it's a PDF
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('Downloaded file is empty');
    }
    
    // Validate PDF
    const isPDF = fileBuffer.toString('utf8', 0, 4) === '%PDF';
    if (!isPDF) {
      throw new Error('Downloaded file is not a valid PDF');
    }

    console.log(`\n✅ PDF validated, Size: ${fileBuffer.length} bytes`);

    // Find candidate in Airtable
    console.log('\n🔍 Searching for candidate in Airtable...');
    console.log(`Base ID: ${airtable_base_id}`);
    console.log(`Table: ${airtable_table_name}`);
    console.log(`Filter: {id} = '${candidate_id}'`);
    
    const searchUrl = `https://api.airtable.com/v0/${airtable_base_id}/${airtable_table_name}`;
    
    const searchResponse = await axios.get(searchUrl, {
      headers: {
        'Authorization': `Bearer ${airtable_token}`
      },
      params: {
        filterByFormula: `{id} = '${candidate_id}'`
      }
    });

    console.log(`📊 Found ${searchResponse.data.records.length} records`);

    if (searchResponse.data.records.length === 0) {
      throw new Error(`Candidate with ID ${candidate_id} not found in Airtable`);
    }

    const recordId = searchResponse.data.records[0].id;
    console.log(`✅ Found candidate record: ${recordId}`);

    // Upload to Airtable using the direct PDF URL
    console.log('\n📤 Uploading to Airtable...');
    console.log(`   - File size: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   - PDF URL: ${pdfDownloadUrl ? pdfDownloadUrl.substring(0, 100) + '...' : 'Not available'}`);

    if (!pdfDownloadUrl) {
      throw new Error('No PDF URL available for Airtable upload');
    }

    try {
      console.log('\n🔄 Updating Airtable record with PDF URL...');
      console.log(`   - Airtable URL: https://api.airtable.com/v0/${airtable_base_id}/${airtable_table_name}/${recordId}`);
      console.log(`   - Field: cv`);
      console.log(`   - Using direct URL (bypassing base64 size limit)`);

      const updatePayload = {
        fields: {
          cv: [
            {
              url: pdfDownloadUrl,
              filename: fileName
            }
          ]
        }
      };

      console.log(`   - Payload:`, JSON.stringify(updatePayload, null, 2));

      const updateResponse = await axios.patch(
        `https://api.airtable.com/v0/${airtable_base_id}/${airtable_table_name}/${recordId}`,
        updatePayload,
        {
          headers: {
            'Authorization': `Bearer ${airtable_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('\n✅ Upload successful!');
      console.log(`   - Response status: ${updateResponse.status}`);
      console.log(`   - Response data:`, JSON.stringify(updateResponse.data, null, 2));
      console.log('\n✅✅✅ CV SUCCESSFULLY UPLOADED TO AIRTABLE! ✅✅✅\n');
    } catch (uploadError) {
      console.error('\n❌ Upload failed with error:');
      console.error(`   - Message: ${uploadError.message}`);
      if (uploadError.response) {
        console.error(`   - Status: ${uploadError.response.status}`);
        console.error(`   - Status Text: ${uploadError.response.statusText}`);
        console.error(`   - Response Data:`, JSON.stringify(uploadError.response.data, null, 2));
        console.error(`   - Response Headers:`, JSON.stringify(uploadError.response.headers, null, 2));
      }
      throw uploadError;
    }

    console.log('✅✅✅ Upload successful! ✅✅✅\n');

    res.json({
      success: true,
      candidate_id: candidate_id,
      record_id: recordId,
      file_size: fileBuffer.length,
      message: 'CV successfully uploaded to Airtable'
    });

  } catch (error) {
    console.error('\n❌❌❌ ERROR ❌❌❌');
    console.error('Error Type:', error.constructor.name);
    console.error('Message:', error.message);
    console.error('Stack Trace:');
    console.error(error.stack);

    if (error.response) {
      console.error('\n📡 HTTP Response Details:');
      console.error('   - Status:', error.response.status);
      console.error('   - Status Text:', error.response.statusText);
      console.error('   - Headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('   - Data:', JSON.stringify(error.response.data, null, 2));
    }

    if (error.config) {
      console.error('\n📤 Request Details:');
      console.error('   - Method:', error.config.method?.toUpperCase());
      console.error('   - URL:', error.config.url);
      console.error('   - Headers:', JSON.stringify(error.config.headers, null, 2));
    }

    res.status(500).json({
      error: error.message,
      candidate_id: candidate_id,
      details: error.response?.data
    });
  } finally {
    console.log('\n⏳ Waiting 5 seconds before closing browser...');
    await wait(5000);

    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed\n');
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}\n`);
});
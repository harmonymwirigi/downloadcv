const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'CV Automation Service Running' });
});

app.post('/process-cv', async (req, res) => {
  const { candidate_id, cv_link, airtable_base_id, airtable_table_name, airtable_token } = req.body;

  if (!candidate_id || !cv_link || !airtable_base_id || !airtable_table_name || !airtable_token) {
    return res.status(400).json({ 
      error: 'Missing required fields'
    });
  }

  try {
    console.log(`Processing CV for candidate: ${candidate_id}`);
    console.log(`CV Link: ${cv_link}`);
    
    // Versuche direkten Download
    console.log('Attempting direct download...');
    const downloadResponse = await axios.get(cv_link, {
      responseType: 'arraybuffer',
      maxRedirects: 5,
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    const fileBuffer = Buffer.from(downloadResponse.data);
    console.log(`Downloaded file, Size: ${fileBuffer.length} bytes`);

    // Prüfe ob es wirklich ein PDF ist
    const isPDF = fileBuffer.toString('utf8', 0, 4) === '%PDF';
    if (!isPDF) {
      throw new Error('Downloaded file is not a PDF. The link might require browser interaction.');
    }

    // Find candidate in Airtable
    console.log('Searching for candidate in Airtable...');
    const searchUrl = `https://api.airtable.com/v0/${airtable_base_id}/${airtable_table_name}`;
    const searchResponse = await axios.get(searchUrl, {
      headers: {
        'Authorization': `Bearer ${airtable_token}`
      },
      params: {
        filterByFormula: `{id} = '${candidate_id}'`
      }
    });

    if (searchResponse.data.records.length === 0) {
      throw new Error(`Candidate with ID ${candidate_id} not found in Airtable`);
    }

    const recordId = searchResponse.data.records[0].id;
    console.log(`Found candidate record: ${recordId}`);

    // Upload to Airtable using base64
    console.log('Uploading to Airtable...');
    const base64Data = fileBuffer.toString('base64');
    
    const updateResponse = await axios.patch(
      `https://api.airtable.com/v0/${airtable_base_id}/${airtable_table_name}/${recordId}`,
      {
        fields: {
          cv: [
            {
              url: `data:application/pdf;base64,${base64Data}`
            }
          ]
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${airtable_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Upload successful!');

    res.json({
      success: true,
      candidate_id: candidate_id,
      record_id: recordId,
      file_size: fileBuffer.length,
      message: 'CV successfully uploaded to Airtable'
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      error: error.message,
      candidate_id: candidate_id,
      details: error.response?.data || null
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
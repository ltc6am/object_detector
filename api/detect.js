// Step 1: Capture image from webpage (e.g., from canvas or file input)
async function detectObjectInWebpage(imageElement, targetObject) {
    // Convert image to base64
    const canvas = document.createElement('canvas');
    canvas.width = imageElement.width;
    canvas.height = imageElement.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageElement, 0, 0);
    const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];
    
    // Step 2: Call DeepSeek API
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer YOUR_DEEPSEEK_API_KEY'
        },
        body: JSON.stringify({
            model: 'deepseek-vl2',  // Vision-language model
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `Detect ${targetObject} in this image. Return bounding box coordinates in format [[x1,y1,x2,y2]].`
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/jpeg;base64,${base64Image}`
                        }
                    }
                ]
            }]
        })
    });
    
    const data = await response.json();
    // Parse coordinates from response (format: <|det|>[[x1,y1,x2,y2]]<|/det|>)
    return parseCoordinates(data.choices[0].message.content);
}

// Step 3: Draw detection boxes on webpage
function drawBoundingBoxes(coordinates, imageElement, originalWidth, originalHeight) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = originalWidth;
    canvas.height = originalHeight;
    ctx.drawImage(imageElement, 0, 0);
    
    coordinates.forEach(coord => {
        // Convert normalized coordinates (0-999) to pixels
        const x1 = (coord[0] / 999) * originalWidth;
        const y1 = (coord[1] / 999) * originalHeight;
        const x2 = (coord[2] / 999) * originalWidth;
        const y2 = (coord[3] / 999) * originalHeight;
        
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    });
    
    return canvas;
}

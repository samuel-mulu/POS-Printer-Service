# POS Printer Service

A lightweight Node.js service (TypeScript) that runs on cashier PCs, accepts print requests from the backend system, and immediately prints receipts via USB or Bluetooth thermal printers.

## Features

- **Immediate Print Execution**: Print jobs are sent directly to the printer without delay or queueing
- **Multiple Printer Support**: Works with USB printers and Bluetooth thermal printers connected via serial COM ports
- **Secure API**: Requires a secret key to prevent unauthorized print jobs
- **Background Service**: Runs continuously in the background, auto-starts on system boot using PM2
- **Retry Mechanism**: Automatically retries failed print jobs (configurable attempts and delay)
- **Simple & Lightweight**: No database or persistent storage needed

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- PM2 (for running as a background service)
- Windows OS (for cashier PCs)

## Installation

1. Clone or download this repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file from the example:

   ```bash
   cp .env.example .env
   ```

4. Configure the `.env` file with your settings (see Configuration section)

5. Build the TypeScript project:
   ```bash
   npm run build
   ```

## Configuration

Edit the `.env` file with your printer settings:

```env
# Server Configuration
PORT=7777

# Printer Interface Type (usb or serial)
PRINTER_INTERFACE=usb

# USB Printer Configuration (required if PRINTER_INTERFACE=usb)
# Find your printer name using: wmic printer list brief (Windows)
PRINTER_USB_NAME=Your-Printer-Name

# Serial/Bluetooth Printer Configuration (required if PRINTER_INTERFACE=serial)
# COM port name, e.g., COM3, COM4
PRINTER_SERIAL_PORT=COM3

# Security
# Secret key for authenticating print requests
PRINT_KEY=your-secret-key-here

# Retry Configuration
MAX_RETRIES=3
RETRY_DELAY_MS=1000
```

### Finding Your Printer Name (USB)

On Windows, open Command Prompt and run:

```bash
wmic printer list brief
```

Look for your thermal printer in the list and use its exact name for `PRINTER_USB_NAME`.

### Finding COM Port (Serial/Bluetooth)

1. Open Device Manager (Win + X, then select Device Manager)
2. Expand "Ports (COM & LPT)"
3. Find your Bluetooth printer and note the COM port (e.g., COM3)

## Running the Service

### Development Mode

```bash
npm run dev
```

### Production Mode

1. Build the project:

   ```bash
   npm run build
   ```

2. Start with PM2:

   ```bash
   npm run pm2:start
   ```

3. Save PM2 configuration:

   ```bash
   npm run pm2:save
   ```

4. Setup PM2 to start on Windows boot:
   ```bash
   npm run pm2:startup
   ```
   Follow the instructions displayed to complete the startup script setup.

### PM2 Management Commands

- `npm run pm2:start` - Start the service
- `npm run pm2:stop` - Stop the service
- `npm run pm2:restart` - Restart the service
- `npm run pm2:delete` - Remove the service from PM2
- `npm run pm2:logs` - View service logs
- `npm run pm2:save` - Save current PM2 process list
- `npm run pm2:startup` - Setup auto-start on Windows boot

## API Documentation

### Print Endpoint

**POST** `/print`

Print a receipt immediately.

#### Authentication

Include the print key in one of the following ways:

1. **Header** (recommended):

   ```
   X-Print-Key: your-secret-key-here
   ```

2. **Request Body**:
   ```json
   {
     "data": "receipt content",
     "key": "your-secret-key-here"
   }
   ```

#### Request Body

**Option 1: JSON**

```json
{
  "data": "=== RECEIPT ===\nItem 1: $10.00\nItem 2: $5.00\nTotal: $15.00"
}
```

**Option 2: Plain Text**

```
=== RECEIPT ===
Item 1: $10.00
Item 2: $5.00
Total: $15.00
```

#### Response

**Success (200 OK)**

```json
{
  "success": true,
  "message": "Print job completed successfully"
}
```

**Error (400/401/500)**

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

### Health Check Endpoint

**GET** `/health`

Check service status and printer connection.

#### Response

```json
{
  "status": "ok",
  "printerConnected": true,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Example Usage

### Using cURL

```bash
# Print with header authentication
curl -X POST http://localhost:7777/print \
  -H "Content-Type: application/json" \
  -H "X-Print-Key: your-secret-key-here" \
  -d '{"data": "Test Receipt\nLine 1\nLine 2"}'

# Print with plain text
curl -X POST http://localhost:7777/print \
  -H "Content-Type: text/plain" \
  -H "X-Print-Key: your-secret-key-here" \
  -d "Test Receipt\nLine 1\nLine 2"
```

### Using JavaScript/Node.js

```javascript
const axios = require("axios");

async function printReceipt() {
  try {
    const response = await axios.post(
      "http://localhost:7777/print",
      {
        data: "=== RECEIPT ===\nItem 1: $10.00\nTotal: $10.00",
      },
      {
        headers: {
          "X-Print-Key": "your-secret-key-here",
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Print success:", response.data);
  } catch (error) {
    console.error("Print error:", error.response?.data || error.message);
  }
}

printReceipt();
```

## Project Structure

```
pos-printer-service/
├── src/
│   ├── index.ts                 # Main HTTP server
│   ├── lib/
│   │   ├── printerManager.ts    # Printer control & retry logic
│   │   └── adapters/
│   │       ├── baseAdapter.ts   # Base adapter interface
│   │       ├── usbAdapter.ts    # USB printer adapter
│   │       └── serialAdapter.ts # Serial/Bluetooth adapter
│   └── types/
│       └── index.ts             # TypeScript type definitions
├── .env                         # Configuration (not in git)
├── .env.example                 # Configuration template
├── ecosystem.config.js          # PM2 configuration
├── tsconfig.json                # TypeScript configuration
└── package.json                 # Dependencies & scripts
```

## Troubleshooting

### Printer Not Connecting

1. **USB Printer**:

   - Verify printer name matches exactly (case-sensitive)
   - Check if printer is powered on and connected
   - Try disconnecting and reconnecting USB cable
   - Run `wmic printer list brief` to verify printer name

2. **Serial/Bluetooth Printer**:
   - Verify COM port is correct in Device Manager
   - Check if another application is using the COM port
   - Try restarting the printer
   - Verify Bluetooth connection is active

### Print Jobs Failing

- Check service logs: `npm run pm2:logs`
- Verify printer is connected: `GET http://localhost:7777/health`
- Check `.env` configuration is correct
- Ensure printer has paper and is not jammed

### Service Won't Start

- Verify all environment variables are set in `.env`
- Check if port 7777 is already in use
- Review error logs: `npm run pm2:logs`
- Ensure TypeScript build completed: `npm run build`

### PM2 Issues

- If PM2 commands fail, ensure PM2 is installed: `npm install -g pm2`
- Check PM2 status: `pm2 list`
- View all PM2 logs: `pm2 logs`

## Development

### Building

```bash
npm run build
```

### Running in Development

```bash
npm run dev
```

The service will run with TypeScript directly (no build step required).

## Security Notes

- **Never commit `.env` file** to version control
- Use a strong, random `PRINT_KEY` in production
- Consider restricting API access to localhost only (modify CORS settings)
- Keep the service updated with security patches

## License

ISC

## Support

For issues or questions, please check the troubleshooting section or review the service logs.

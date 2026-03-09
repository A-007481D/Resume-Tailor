.PHONY: install start dev clean

# Install all NodeJS dependencies
install:
	npm install

# Start the application server normally
start: 
	node server.js

# Start the application in development mode (auto-restarts on changes if you have nodemon)
# Or runs watch mode in Node 20+
dev:
	node --watch server.js

# Clean all node_modules and output files
clean:
	rm -rf node_modules
	rm -rf public/output/*.pdf

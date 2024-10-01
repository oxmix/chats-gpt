### Development
```shell
npm i
npm start
```

### Build all platform
```shell
npm run build
```

### Build for only mac
```shell
npm run build -- --mac
```

### Self-signed not working
> But there is a way out, client must delete attr com.apple.quarantine
```shell
xattr -d com.apple.quarantine /Applications/ChatGPT.app
```
# watkit_packages
source code and browser benchmarks for simple watkit packages.  
always structured as:  
```
package_name/
    src/
        main.wat 
        additional_functions.wat
    dist/
        main.wasm
        additional_functions.wasm
    benchmark/ 
        index.html
        benchmark.js
        benchmark.css
    watkit.json
    README.md
```
for any given package, start a live server (however you prefer to do that works but I like VSCodium's five-server) and open index.html. check per-package README.md for more details on any given package.
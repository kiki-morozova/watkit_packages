# mem_utils
a module for memory manipulation with simd, currently implements xor and reverse.  
in browser testing, xor_mem_blocks shows consistent tenfold speedups over a standard js implementations and both reversal functions show 10x speedups over a standard js implementation. please note your mileage may vary; reverse_mem_block_bytes_copy sometimes performs up to 24x better than js on some very long sequences, but sometimes performs only about 8x better. 

>**note:** this package is in active development and will be updated with more useful functions as they are needed (feel free to send recommendations to the author!).

## benchmarks 
![benchmark results](./benchmark/assets/variance1.png)
![benchmark results](./benchmark/assets/variance2.png)
as you can see, there's a good bit of performance variance between runs, but the wasm functions are consistently at least 5x faster than js, and usually are between 8x and 15x faster. 

## functions
### reverse_mem_block_bytes
> ** warning: not in place! **  

reverses a memory block.
params: 
- `mem_blk_ptr`: pointer to the memory block to reverse
- `mem_blk_len`: length of the memory block
- `write_ptr`: pointer to the memory block to write the result to

returns: none!

### xor_mem_blocks
> ** warning: not in place! **  

xors two memory blocks of equal length. 
params: 
- `a_ptr`: pointer to the first memory block
- `b_ptr`: pointer to the second memory block
- `len`: length of the memory blocks
- `write_ptr`: pointer to the memory block to write the result to

returns: none!

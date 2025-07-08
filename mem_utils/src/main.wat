(module 
    (memory (export "memory") 1 8192)

    (func (export "reverse_mem_block_bytes_copy") ;; NOT AN IN PLACE OPERATION
        (param $mem_blk_ptr i32)
        (param $mem_blk_len i32) ;; in bytes
        (param $write_ptr i32)

        (local $unaligned_tail_len i32)
        (local $curr_read_ptr i32)
        (local $curr_write_ptr i32)
        (local $remainder_after_simd i32)
        (local $num_simd_blocks i32)
        (local $simd_block_counter i32)
        
        (local $shuffling_vector v128)

        (local.set $curr_read_ptr (i32.add (local.get $mem_blk_ptr) (i32.sub (local.get $mem_blk_len) (i32.const 1))))
        (local.set $curr_write_ptr (local.get $write_ptr))
        ;; check alignment of end of mem block
        (local.set $unaligned_tail_len
            (i32.rem_u (local.get $curr_read_ptr) (i32.const 16))
        )
        ;; compute the number of SIMD blocks 
        (local.set $num_simd_blocks
            (i32.div_u (i32.sub (local.get $mem_blk_len) (local.get $unaligned_tail_len)) (i32.const 16))
        )
        ;; compute remainder (how much to loop) after simd blocks
        (local.set $remainder_after_simd
            (i32.rem_u (i32.sub (local.get $mem_blk_len) (local.get $unaligned_tail_len)) (i32.const 16))
        )
        
        (block $handle_pre_aligned_chunk
            (loop $unaligned_bytes
                (br_if $handle_pre_aligned_chunk (i32.eqz (local.get $unaligned_tail_len)))
                (i32.store8
                    (local.get $curr_write_ptr)
                    (i32.load8_u(local.get $curr_read_ptr))
                )
                ;; num unaligned bytes left--
                (local.set $unaligned_tail_len (i32.sub (local.get $unaligned_tail_len) (i32.const 1)))
                ;; read ptr -- 
                (local.set $curr_read_ptr (i32.sub (local.get $curr_read_ptr) (i32.const 1)))
                ;; write ptr ++
                (local.set $curr_write_ptr (i32.add (local.get $curr_write_ptr) (i32.const 1)))
                (br $unaligned_bytes)
            )
        )
        (local.set $curr_read_ptr (i32.add (local.get $curr_read_ptr) (i32.const 1)))

        (local.set $simd_block_counter (i32.const 0))
        (block $reverse_with_simd
            (loop $simd_batch
                (br_if $reverse_with_simd (i32.ge_u (local.get $simd_block_counter) (local.get $num_simd_blocks)))
                ;; read ptr - 16
                (local.set $curr_read_ptr (i32.sub (local.get $curr_read_ptr) (i32.const 16)))

                (local.set $shuffling_vector
                    (v128.load
                        (local.get $curr_read_ptr)
                    )
                )

                (v128.store
                    (local.get $curr_write_ptr)
                    (i8x16.shuffle 
                        15 14 13 12 11 10 9 8 7 6 5 4 3 2 1 0
                        (local.get $shuffling_vector)
                        (local.get $shuffling_vector)
                    )
                )
                ;; write pointer + 16 only after store
                (local.set $curr_write_ptr (i32.add (local.get $curr_write_ptr) (i32.const 16)))

                ;; simd_block_counter++
                (local.set $simd_block_counter (i32.add (local.get $simd_block_counter) (i32.const 1)))
                (br $simd_batch)
            )
        )

        (local.set $curr_read_ptr (i32.sub (local.get $curr_read_ptr) (i32.const 1)))

        ;; after simd, do remainder
        (block $handle_post_aligned_chunk
            (loop $post_unaligned_bytes
                (br_if $handle_post_aligned_chunk (i32.eqz (local.get $remainder_after_simd)))
                (i32.store8
                    (local.get $curr_write_ptr)
                    (i32.load8_u(local.get $curr_read_ptr))
                )
                ;; num unaligned bytes left--
                (local.set $remainder_after_simd (i32.sub (local.get $remainder_after_simd) (i32.const 1)))
                ;; read ptr -- 
                (local.set $curr_read_ptr (i32.sub (local.get $curr_read_ptr) (i32.const 1)))
                ;; write ptr ++
                (local.set $curr_write_ptr (i32.add (local.get $curr_write_ptr) (i32.const 1)))
                (br $post_unaligned_bytes)
            )
        )
    )

  (func (export "reverse_mem_block_in_place_simd") ;; is in place, does this by "squeezing" the mem towards the middle and then handling the middle scalar
      (param $ptr i32)
      (param $len i32)

      (local $left i32)
      (local $right i32)
      (local $num_blocks i32)
      (local $block_size i32)
      (local $i i32)

      (local $left_vec v128)
      (local $right_vec v128)
      (local $tmp v128)

      (local $mid_start i32)
      (local $mid_len i32)
      (local $tmp1 i32)
      (local $tmp2 i32)

      (local.set $block_size (i32.const 16))
      
      ;; check if len < 32, simd can't handle small
      (if (i32.lt_u (local.get $len) (i32.const 32))
        (then
          (local.set $i (i32.const 0))
          (block $scalar_only_done
            (loop $scalar_only_loop
              (br_if $scalar_only_done 
                (i32.ge_u (local.get $i) (i32.div_u (local.get $len) (i32.const 2)))
              )
              
              (local.set $tmp1
                (i32.load8_u (i32.add (local.get $ptr) (local.get $i)))
              )
              (local.set $tmp2
                (i32.load8_u (i32.sub
                  (i32.add (local.get $ptr) (local.get $len))
                  (i32.add (local.get $i) (i32.const 1))
                ))
              )
              
              ;; store swapped
              (i32.store8
                (i32.add (local.get $ptr) (local.get $i))
                (local.get $tmp2)
              )
              (i32.store8
                (i32.sub
                  (i32.add (local.get $ptr) (local.get $len))
                  (i32.add (local.get $i) (i32.const 1))
                )
                (local.get $tmp1)
              )
              
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $scalar_only_loop)
            )
          )
          (return)
        )
      )

      ;; check how many 16-byte blocks we can process from each end
      (local.set $num_blocks (i32.div_u (local.get $len) (i32.const 2)))
      (local.set $num_blocks (i32.div_u (local.get $num_blocks) (local.get $block_size)))

      (local.set $i (i32.const 0))
      (block $exit
        (loop $rev_loop
          (br_if $exit (i32.ge_u (local.get $i) (local.get $num_blocks)))

          (local.set $left
            (i32.add (local.get $ptr) (i32.mul (local.get $i) (local.get $block_size)))
          )
          (local.set $right
            (i32.sub
              (i32.add (local.get $ptr) (local.get $len))
              (i32.mul (i32.add (local.get $i) (i32.const 1)) (local.get $block_size))
            )
          )

          ;; overlap check!!
          (if (i32.ge_u (local.get $left) (local.get $right))
            (then (br $exit))
          )

          ;; for left and right, load & reverse vecs
          (local.set $left_vec
            (i8x16.shuffle 
              15 14 13 12 11 10 9 8 7 6 5 4 3 2 1 0
              (v128.load (local.get $left))
              (v128.load (local.get $left))
            )
          )
          (local.set $right_vec
            (i8x16.shuffle 
              15 14 13 12 11 10 9 8 7 6 5 4 3 2 1 0
              (v128.load (local.get $right))
              (v128.load (local.get $right))
            )
          )

          ;; store them swapped! (so now it's squeezed in by one)
          (v128.store (local.get $left) (local.get $right_vec))
          (v128.store (local.get $right) (local.get $left_vec))

          ;;i++ (left++, right--)
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $rev_loop)
        )
      )

      ;; handle scalar middle section
      (local.set $mid_start (i32.mul (local.get $num_blocks) (i32.const 16)))
      (local.set $mid_len (i32.sub (local.get $len) (i32.mul (local.get $num_blocks) (i32.const 32))))
      
      ;; are there bytes left? process em scalar
      (if (i32.gt_u (local.get $mid_len) (i32.const 0))
        (then
          (local.set $i (i32.const 0))
          (block $done
            (loop $scalar_rev
              (br_if $done (i32.ge_u (local.get $i) (i32.div_u (local.get $mid_len) (i32.const 2))))

              (local.set $tmp1
                (i32.load8_u (i32.add (local.get $ptr) (i32.add (local.get $mid_start) (local.get $i))))
              )
              (local.set $tmp2
                (i32.load8_u (i32.sub
                  (i32.add (local.get $ptr) (i32.add (local.get $mid_start) (local.get $mid_len)))
                  (i32.add (local.get $i) (i32.const 1))
                ))
              )

              ;; store swapped
              (i32.store8
                (i32.add (local.get $ptr) (i32.add (local.get $mid_start) (local.get $i)))
                (local.get $tmp2)
              )
              (i32.store8
                (i32.sub
                  (i32.add (local.get $ptr) (i32.add (local.get $mid_start) (local.get $mid_len)))
                  (i32.add (local.get $i) (i32.const 1))
                )
                (local.get $tmp1)
              )

              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $scalar_rev)
            )
          )
        )
      )
  )

  (func (export "xor_mem_blocks") ;; NOT AN IN PLACE OPERATION
    (param $a_ptr i32) ;; a and b must be the same length (obv?)
    (param $b_ptr i32)
    (param $len i32)
    (param $write_ptr i32)

    (local $unaligned_head_len i32)
    (local $unaligned_tail_len i32)
    (local $aligned_len i32)
    (local $offset i32)
    (local $simd_block_counter i32)
    (local $a_vec v128)
    (local $b_vec v128)
    (local $a_curr i32)
    (local $b_curr i32)
    (local $w_curr i32)

    (local.set $a_curr (local.get $a_ptr))
    (local.set $b_curr (local.get $b_ptr))
    (local.set $w_curr (local.get $write_ptr))

    ;; calc unaligned head length
    (local.set $unaligned_head_len
      (i32.rem_u (local.get $a_curr) (i32.const 16))
    )

    ;; process head bytes
    (block $aligned
      (loop $unaligned_head_loop
        (br_if $aligned (i32.eqz (local.get $unaligned_head_len)))
        ;; store a[i] ^ b[i] to w[i]
        (i32.store8
          (local.get $w_curr)
          (i32.xor
            (i32.load8_u (local.get $a_curr))
            (i32.load8_u (local.get $b_curr))
          )
        )
        ;; a++, b++, w++
        (local.set $a_curr (i32.add (local.get $a_curr) (i32.const 1)))
        (local.set $b_curr (i32.add (local.get $b_curr) (i32.const 1)))
        (local.set $w_curr (i32.add (local.get $w_curr) (i32.const 1)))

        ;; unaligned head len--
        (local.set $unaligned_head_len (i32.sub (local.get $unaligned_head_len) (i32.const 1)))
        (br $unaligned_head_loop)
      )
    )

    ;; how many full, aligned 16-byte blocks can we simd over? aligned = speedup which is why we handle the head and tail separately
    (local.set $aligned_len
      (i32.and (local.get $len) (i32.const -16))
    )

    (local.set $simd_block_counter (i32.const 0))

    ;; simd xor
    (block $done_simd
      (loop $simd_loop
        (br_if $done_simd
          (i32.ge_u
            (local.get $simd_block_counter)
            (i32.div_u (local.get $aligned_len) (i32.const 16))
          )
        )

        (local.set $a_vec (v128.load (local.get $a_curr)))
        (local.set $b_vec (v128.load (local.get $b_curr)))

        ;; xor the 16 bytes we just loaded
        (v128.store
          (local.get $w_curr)
          (v128.xor (local.get $a_vec) (local.get $b_vec))
        )

        ;; move forward
        (local.set $a_curr (i32.add (local.get $a_curr) (i32.const 16)))
        (local.set $b_curr (i32.add (local.get $b_curr) (i32.const 16)))
        (local.set $w_curr (i32.add (local.get $w_curr) (i32.const 16)))
        (local.set $simd_block_counter (i32.add (local.get $simd_block_counter) (i32.const 1)))

        (br $simd_loop)
      )
    )

    ;; tail: any bytes not covered by simd (bc the length was not a multiple of 16 and the head was made aligned)
    (local.set $unaligned_tail_len
      (i32.sub (local.get $len)
               (i32.add
                 (i32.sub (local.get $a_curr) (local.get $a_ptr))
                 (i32.const 0)
               )
      )
    )

    ;; handle tail like head
    (block $done_tail
      (loop $tail_loop
        (br_if $done_tail (i32.eqz (local.get $unaligned_tail_len)))

        (i32.store8
          (local.get $w_curr)
          (i32.xor
            (i32.load8_u (local.get $a_curr))
            (i32.load8_u (local.get $b_curr))
          )
        )
        (local.set $a_curr (i32.add (local.get $a_curr) (i32.const 1)))
        (local.set $b_curr (i32.add (local.get $b_curr) (i32.const 1)))
        (local.set $w_curr (i32.add (local.get $w_curr) (i32.const 1)))
        (local.set $unaligned_tail_len (i32.sub (local.get $unaligned_tail_len) (i32.const 1)))
        (br $tail_loop)
      )
    )
  )
)


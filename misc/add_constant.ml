(* 新しいバージョンに変わったとき、定数表に新バージョンの定数を加えるやつ *)

#load "str.cma"

(* stringのsplit *)
let string_sep separator str = Str.split (Str.regexp separator) str

let () =
  (* 定数表を指定 *)
  let input_file = "constant.js" in
  let output_file = "output.js" in
  let ic = open_in input_file in
  let oc = open_out output_file in
  let () = output_string oc "[\n" in
  (* 1行目は無視 *)
  let () = ignore (input_line ic) in
  let rec read () =
    let line = input_line ic in
    if line = "]"
    then 
      let () = close_in ic in 
      let () = output_string oc "]" in
      close_out oc
    else
      let slist = string_sep "star:" line in
      let title = List.nth (string_sep "\"" line) 1 in
      let diff = List.nth (string_sep "," (List.nth (string_sep "difficulty: " line) 1)) 0 in
      let () = print_string (title ^ ", 難易度" ^ diff ^ "の定数は?: ") in
      let input = read_line () in
      let output = (List.nth slist 0) ^ "starplus: " ^ input ^ ", star:" ^ (List.nth slist 1) ^ "\n" in
      let () = output_string oc output in
      read ()
  in
  read ()

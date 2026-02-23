import pandas as pd

def merge_csv_unique(file1, file2, output_file):
    # Load the CSV files into DataFrames
    df1 = pd.read_csv(file1)
    df2 = pd.read_csv(file2)

    # Concatenate the two dataframes
    combined_df = pd.concat([df1, df2])

    # Remove duplicate rows
    # 'keep=first' ensures we keep the first occurrence and drop subsequent ones
    unique_df = combined_df.drop_duplicates()

    # Save the result to a new CSV
    unique_df.to_csv(output_file, index=False)
    
    print(f"Successfully merged! Unique rows saved to: {output_file}")
    print(f"Total rows after merge: {len(unique_df)}")

# Usage
merge_csv_unique("C://Users//User//Downloads//materials_export.csv", "C://repo//project//src//data//merged_unique1.csv", 'merged_unique2.csv')
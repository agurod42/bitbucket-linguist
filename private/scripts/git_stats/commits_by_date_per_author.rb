require 'git_stats'
require 'json'

repo = GitStats::GitData::Repo.new(path: ARGV[0])
res = { :authors => Hash.new }

for author in repo.authors

    if !res[:authors][author.email].present?
        res[:authors][author.email] = Hash.new
    end
    
    for commit in author.commits
        date = commit.date.to_date

        if !res[:min_date].present? or date < res[:min_date]
            res[:min_date] = date
        end

        if !res[:max_date].present? or date > res[:max_date]
            res[:max_date] = date
        end
        
        res[:authors][author.email][date] = res[:authors][author.email].has_key?(date) ? res[:authors][author.email][date] + 1 : 1
    end

end

puts JSON.pretty_generate(res)